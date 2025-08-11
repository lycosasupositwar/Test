from flask import current_app, request, jsonify
from .models import db, Project, Sample
import cv2
import numpy as np
import os

# --- Project Routes ---

@current_app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json()
    if not data or 'name' not in data or not data['name'].strip():
        return jsonify({'error': 'Project name is required'}), 400

    if Project.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'A project with this name already exists'}), 409

    new_project = Project(name=data['name'], description=data.get('description', ''))
    db.session.add(new_project)
    db.session.commit()
    return jsonify(new_project.to_dict()), 201

@current_app.route('/api/projects', methods=['GET'])
def get_projects():
    projects = Project.query.order_by(Project.created_at.desc()).all()
    return jsonify([p.to_dict() for p in projects])

@current_app.route('/api/projects/<int:id>', methods=['GET'])
def get_project(id):
    project = Project.query.get_or_404(id)
    return jsonify(project.to_dict())

@current_app.route('/api/projects/<int:id>', methods=['PUT'])
def update_project(id):
    project = Project.query.get_or_404(id)
    data = request.get_json()

    if 'name' in data and data['name'] != project.name:
        if not data['name'].strip():
            return jsonify({'error': 'Project name is required'}), 400
        if Project.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'A project with this name already exists'}), 409
        project.name = data['name']

    if 'description' in data:
        project.description = data['description']

    db.session.commit()
    return jsonify(project.to_dict())

@current_app.route('/api/projects/<int:id>', methods=['DELETE'])
def delete_project(id):
    project = Project.query.get_or_404(id)
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Project deleted successfully'}), 200


import uuid
from werkzeug.utils import secure_filename

# --- Sample Routes ---

@current_app.route('/api/projects/<int:project_id>/samples', methods=['GET'])
def get_samples_for_project(project_id):
    Project.query.get_or_404(project_id) # Ensure project exists
    samples = Sample.query.filter_by(project_id=project_id).order_by(Sample.created_at.desc()).all()
    return jsonify([s.to_dict() for s in samples])


@current_app.route('/api/projects/<int:project_id>/samples', methods=['POST'])
def create_sample(project_id):
    project = Project.query.get_or_404(project_id)

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    sample_name = request.form.get('name', 'Unnamed Sample')

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        # Create a unique filename
        original_filename = secure_filename(file.filename)
        ext = os.path.splitext(original_filename)[1]
        unique_filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)

        file.save(filepath)

        # --- Image Processing ---
        img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
        if img is None:
            os.remove(filepath)
            return jsonify({'error': 'Could not read image file. It might be corrupted or in an unsupported format.'}), 400

        image_height_px, image_width_px = img.shape

        blurred = cv2.GaussianBlur(img, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        contours_json = []
        for contour in contours:
            epsilon = 0.005 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            contours_json.append(approx.tolist())

        # --- Database Record Creation ---
        new_sample = Sample(
            name=sample_name,
            image_filename=unique_filename,
            project_id=project.id,
            results={
                'contours': contours_json,
                'image_width_px': image_width_px,
                'image_height_px': image_height_px
            }
        )
        db.session.add(new_sample)
        db.session.commit()

        return jsonify(new_sample.to_dict()), 201

    return jsonify({'error': 'File upload failed'}), 400


@current_app.route('/api/samples/<int:sample_id>', methods=['DELETE'])
def delete_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)

    # Delete the associated image file
    try:
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], sample.image_filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        # Log this error but don't block the DB deletion
        current_app.logger.error(f"Error deleting file {sample.image_filename}: {e}")

    db.session.delete(sample)
    db.session.commit()

    return jsonify({'message': 'Sample deleted successfully'}), 200


@current_app.route('/api/samples/<int:sample_id>/calibrate', methods=['POST'])
def calibrate_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    data = request.get_json()

    if not data or 'scale_pixels_per_mm' not in data:
        return jsonify({'error': 'Missing scale_pixels_per_mm value'}), 400

    try:
        scale = float(data['scale_pixels_per_mm'])
        if scale <= 0:
            raise ValueError("Scale must be a positive number.")
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid scale value. Must be a positive number.'}), 400

    sample.scale_pixels_per_mm = scale
    db.session.commit()

    return jsonify(sample.to_dict())


# --- Export Routes ---
import io
import pandas as pd
from flask import send_file, render_template
from weasyprint import HTML
import base64

def get_image_as_b64(filepath):
    """Helper to read an image file and return its base64 string."""
    with open(filepath, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def get_segmented_image_as_b64(sample, img_dims):
    """Helper to draw contours and return a base64 string of the image."""
    canvas = np.zeros((img_dims[0], img_dims[1], 3), dtype=np.uint8)
    contours = [np.array(c, dtype=np.int32) for c in sample.results['contours']]
    cv2.drawContours(canvas, contours, -1, (255, 255, 255), 1)
    _, buffer = cv2.imencode('.png', canvas)
    return base64.b64encode(buffer).decode('utf-8')


@current_app.route('/api/samples/<int:sample_id>/export/csv', methods=['GET'])
def export_csv(sample_id):
    sample = Sample.query.get_or_404(sample_id)

    if not sample.results or 'measurements' not in sample.results:
        return jsonify({'error': 'No measurement data to export.'}), 404

    measurements = sample.results['measurements']
    df = pd.DataFrame(measurements)

    # Create an in-memory buffer
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)

    # Reset buffer pointer
    buffer.seek(0)

    return send_file(
        io.BytesIO(buffer.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'sample_{sample.id}_measurements.csv'
    )

@current_app.route('/api/samples/<int:sample_id>/export/pdf', methods=['GET'])
def export_pdf(sample_id):
    from datetime import datetime
    sample = Sample.query.get_or_404(sample_id)

    if not sample.results:
        return jsonify({'error': 'No results to export.'}), 404

    # Get images as b64 strings
    original_image_path = os.path.join(current_app.config['UPLOAD_FOLDER'], sample.image_filename)
    original_image_b64 = f"data:image/png;base64,{get_image_as_b64(original_image_path)}"

    img_dims = (sample.results['image_height_px'], sample.results['image_width_px'])
    segmented_image_b64 = f"data:image/png;base64,{get_segmented_image_as_b64(sample, img_dims)}"

    # Render HTML template
    html_out = render_template(
        'report.html',
        sample=sample,
        project_name=sample.project.name,
        date=datetime.now().strftime('%Y-%m-%d'),
        original_image_b64=original_image_b64,
        segmented_image_b64=segmented_image_b64
    )

    # Convert HTML to PDF
    pdf = HTML(string=html_out).write_pdf()

    return send_file(
        io.BytesIO(pdf),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'sample_{sample.id}_report.pdf'
    )


@current_app.route('/api/samples/<int:sample_id>/multiphase', methods=['POST'])
def multiphase_analysis(sample_id):
    import base64
    sample = Sample.query.get_or_404(sample_id)
    data = request.get_json()

    if not data or 'threshold' not in data:
        return jsonify({'error': 'Threshold value is required.'}), 400
    try:
        threshold_value = int(data['threshold'])
        if not (0 <= threshold_value <= 255):
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid threshold value. Must be an integer between 0 and 255.'}), 400

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], sample.image_filename)
    img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return jsonify({'error': 'Could not read image file.'}), 400

    # Apply binary threshold
    _, binary_img = cv2.threshold(img, threshold_value, 255, cv2.THRESH_BINARY)

    # Calculate phase ratio
    total_pixels = img.size
    phase_1_pixels = cv2.countNonZero(binary_img) # White pixels
    phase_2_pixels = total_pixels - phase_1_pixels # Black pixels

    phase_1_ratio = (phase_1_pixels / total_pixels) * 100
    phase_2_ratio = (phase_2_pixels / total_pixels) * 100

    # Encode the binary image to send to frontend for preview
    _, buffer = cv2.imencode('.png', binary_img)
    binary_img_str = base64.b64encode(buffer).decode('utf-8')

    # Update results
    if not isinstance(sample.results, dict):
        sample.results = {}

    sample.results['multiphase'] = {
        'threshold': threshold_value,
        'phase_1_percent': phase_1_ratio,
        'phase_2_percent': phase_2_ratio,
        'preview_image': f"data:image/png;base64,{binary_img_str}"
    }

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(sample, "results")
    db.session.commit()

    return jsonify(sample.to_dict())


@current_app.route('/api/samples/<int:sample_id>/astm-e112', methods=['POST'])
def astm_e112_planimetric(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    data = request.get_json()

    if not data or 'magnification' not in data:
        return jsonify({'error': 'Magnification is required.'}), 400
    try:
        magnification = float(data['magnification'])
        if magnification <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid magnification value.'}), 400

    if not sample.results or 'measurements' not in sample.results:
        return jsonify({'error': 'Measurements must be calculated first.'}), 400

    if not sample.scale_pixels_per_mm:
        return jsonify({'error': 'Sample must be calibrated first.'}), 400

    # Get total image area in mm^2 from stored dimensions
    if not sample.results.get('image_width_px') or not sample.results.get('image_height_px'):
        return jsonify({'error': 'Image dimensions not found. Please re-upload the sample.'}), 400

    image_width_px = sample.results['image_width_px']
    image_height_px = sample.results['image_height_px']

    total_area_mm2 = (image_width_px * image_height_px) / (sample.scale_pixels_per_mm ** 2)

    num_grains = len(sample.results['measurements'])

    # Grains per square millimeter
    n_mm2 = num_grains / total_area_mm2

    # Conversion factor from ASTM E112 standard for N_A (number of grains per in^2 at 100x)
    # N_A = n_mm2 * (M/100)^2, where M is magnification
    # 1 inch = 25.4 mm => 1 in^2 = 645.16 mm^2
    n_in2 = n_mm2 * 645.16 # grains per in^2 at 1x
    N_A = n_in2 * ((magnification / 100.0) ** 2)

    # from N_A = 2^(G-1) => log2(N_A) = G - 1 => G = log2(N_A) + 1
    if N_A <= 0:
        return jsonify({'error': 'Cannot calculate ASTM number for zero or negative grain density.'}), 400

    G = (np.log2(N_A)) + 1

    # Update results
    if not isinstance(sample.results, dict):
        sample.results = {}

    sample.results['astm_g'] = G
    sample.results['astm_n_a'] = N_A

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(sample, "results")
    db.session.commit()

    return jsonify(sample.to_dict())

# --- Manual Editing Routes ---

@current_app.route('/api/samples/<int:sample_id>/retouch', methods=['POST'])
def retouch_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    data = request.get_json()

    if not data or 'contours' not in data:
        return jsonify({'error': 'Request must contain a list of contours.'}), 400

    if not isinstance(sample.results, dict):
        sample.results = {}

    # Overwrite contours and delete old measurements
    sample.results['contours'] = data['contours']
    if 'measurements' in sample.results:
        del sample.results['measurements']

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(sample, "results")

    db.session.commit()
    return jsonify(sample.to_dict())


from shapely.geometry import Polygon, LineString

@current_app.route('/api/actions/split-contour', methods=['POST'])
def split_contour():
    data = request.get_json()
    if not data or 'contour' not in data or 'line' not in data:
        return jsonify({'error': 'Request must contain a contour and a line.'}), 400

    try:
        contour_points = data['contour']
        line_points = data['line']

        # Ensure contour is closed for polygon creation
        if contour_points[0] != contour_points[-1]:
            contour_points.append(contour_points[0])

        polygon = Polygon(contour_points)
        line = LineString(line_points)

        # Buffer the line slightly to ensure it properly cuts the polygon
        split_polygons = polygon.difference(line.buffer(0.001))

        if split_polygons.is_empty:
            return jsonify({'error': 'Splitting resulted in an empty geometry.'}), 400

        new_contours_json = []
        # The result can be a single Polygon or a MultiPolygon
        if split_polygons.geom_type == 'Polygon':
            polygons = [split_polygons]
        else:
            polygons = list(split_polygons.geoms)

        for poly in polygons:
            # Convert Shapely polygon back to OpenCV contour format
            exterior_coords = np.array(poly.exterior.coords, dtype=np.int32)
            # Reshape to (num_points, 1, 2)
            new_contours_json.append(exterior_coords.reshape((-1, 1, 2)).tolist())

        return jsonify({'new_contours': new_contours_json})

    except Exception as e:
        current_app.logger.error(f"Error splitting contour: {e}")
        return jsonify({'error': 'An internal error occurred during the split operation.'}), 500


@current_app.route('/api/samples/<int:sample_id>/measure', methods=['POST'])
def measure_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)

    if not sample.scale_pixels_per_mm:
        return jsonify({'error': 'Sample must be calibrated before measuring.'}), 400

    if not sample.results or 'contours' not in sample.results:
        return jsonify({'error': 'No contours found for this sample. Please segment the image first.'}), 400

    scale = sample.scale_pixels_per_mm
    # Contours are stored as JSON, need to convert them back to numpy arrays
    contours_list = sample.results['contours']
    contours = [np.array(c, dtype=np.int32) for c in contours_list]

    measurements = []
    for i, contour in enumerate(contours):
        if len(contour) < 5: # Not enough points to fit an ellipse
            continue

        area_px = cv2.contourArea(contour)
        area_mm = area_px / (scale ** 2)

        perimeter_px = cv2.arcLength(contour, True)
        perimeter_mm = perimeter_px / scale

        # Equivalent diameter from area
        equiv_diameter_mm = 2 * np.sqrt(area_mm / np.pi)

        # Bounding ellipse for orientation
        (x, y), (MA, ma), angle = cv2.fitEllipse(contour)

        measurements.append({
            'grain_id': i + 1,
            'area_px': area_px,
            'area_mm2': area_mm,
            'perimeter_mm': perimeter_mm,
            'equiv_diameter_mm': equiv_diameter_mm,
            'orientation_deg': angle,
            'center_x_px': x,
            'center_y_px': y,
        })

    # Update the results JSON blob
    # Make sure to handle the case where results is None or not a dict
    if not isinstance(sample.results, dict):
        sample.results = {}

    sample.results['measurements'] = measurements

    # Flag the sample as modified to ensure SQLAlchemy updates the JSON field
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(sample, "results")

    db.session.commit()

    return jsonify(sample.to_dict())
