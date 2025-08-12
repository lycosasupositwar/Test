from flask import current_app, request, jsonify, send_file, send_from_directory
from flask_login import login_user, logout_user, current_user, login_required
from .models import db, User, Project, Sample
import cv2
import numpy as np
import os
import uuid
from werkzeug.utils import secure_filename
from sqlalchemy.orm.attributes import flag_modified
import io
import pandas as pd
import base64
from shapely.geometry import Polygon, LineString
from datetime import datetime

# --- Auth Routes ---
@current_app.route('/api/@me')
def get_current_user():
    if not current_user.is_authenticated:
        return jsonify(None), 200
    return jsonify({
        'id': current_user.id,
        'username': current_user.username
    })

@current_app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username is already taken'}), 400

    user = User(username=data['username'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    login_user(user, remember=True)
    return jsonify({'id': user.id, 'username': user.username}), 201

@current_app.route('/api/login', methods=['POST'])
def login():
    if current_user.is_authenticated:
        return get_current_user()
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400

    user = User.query.filter_by(username=data['username']).first()
    if user is None or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401

    login_user(user, remember=True)
    return jsonify({'id': user.id, 'username': user.username})

@current_app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'})


# --- Project Routes ---
@current_app.route('/api/projects', methods=['POST'])
@login_required
def create_project():
    data = request.get_json()
    if not data or 'name' not in data or not data['name'].strip():
        return jsonify({'error': 'Project name is required'}), 400
    if Project.query.filter_by(name=data['name'], user_id=current_user.id).first():
        return jsonify({'error': 'A project with this name already exists'}), 409
    new_project = Project(name=data['name'], description=data.get('description', ''), owner=current_user)
    db.session.add(new_project)
    db.session.commit()
    return jsonify(new_project.to_dict()), 201

@current_app.route('/api/projects', methods=['GET'])
@login_required
def get_projects():
    projects = Project.query.filter_by(user_id=current_user.id).order_by(Project.created_at.desc()).all()
    return jsonify([p.to_dict() for p in projects])

@current_app.route('/api/projects/<int:id>', methods=['GET'])
@login_required
def get_project(id):
    project = Project.query.get_or_404(id)
    if project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    return jsonify(project.to_dict())

@current_app.route('/api/projects/<int:id>', methods=['PUT'])
@login_required
def update_project(id):
    project = Project.query.get_or_404(id)
    if project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    data = request.get_json()
    if 'name' in data and data['name'] != project.name:
        if not data['name'].strip():
            return jsonify({'error': 'Project name is required'}), 400
        if Project.query.filter_by(name=data['name'], user_id=current_user.id).first():
            return jsonify({'error': 'A project with this name already exists'}), 409
        project.name = data['name']
    if 'description' in data:
        project.description = data['description']
    db.session.commit()
    return jsonify(project.to_dict())

@current_app.route('/api/projects/<int:id>', methods=['DELETE'])
@login_required
def delete_project(id):
    project = Project.query.get_or_404(id)
    if project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Project deleted successfully'}), 200

# --- Sample Routes ---
@current_app.route('/api/projects/<int:project_id>/samples', methods=['GET'])
@login_required
def get_samples_for_project(project_id):
    project = Project.query.get_or_404(project_id)
    if project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    samples = Sample.query.filter_by(project_id=project_id).order_by(Sample.created_at.desc()).all()
    return jsonify([s.to_dict() for s in samples])

@current_app.route('/api/projects/<int:project_id>/samples', methods=['POST'])
@login_required
def create_sample(project_id):
    project = Project.query.get_or_404(project_id)
    if project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    sample_name = request.form.get('name', 'Unnamed Sample')
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        original_filename = secure_filename(file.filename)
        ext = os.path.splitext(original_filename)[1]
        unique_filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        # Note: cv2.imread may not support all TIFF formats (e.g., compressed or floating-point).
        # For broader TIFF support, a library like tifffile might be necessary.
        img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
        if img is None:
            os.remove(filepath)
            return jsonify({'error': 'Could not read image file.'}), 400
        image_height_px, image_width_px = img.shape
        blurred = cv2.GaussianBlur(img, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours_json = [c.tolist() for c in contours]
        new_sample = Sample(
            name=sample_name,
            image_filename=unique_filename,
            project_id=project.id,
            results={'contours': contours_json, 'image_width_px': image_width_px, 'image_height_px': image_height_px}
        )
        db.session.add(new_sample)
        db.session.commit()
        return jsonify(new_sample.to_dict()), 201
    return jsonify({'error': 'File upload failed'}), 400

@current_app.route('/api/samples/<int:sample_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if sample.project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403

    if request.method == 'PUT':
        data = request.get_json()
        if not data or 'name' not in data or not data['name'].strip():
            return jsonify({'error': 'Sample name is required'}), 400
        sample.name = data['name'].strip()
        db.session.commit()
        return jsonify(sample.to_dict())

    if request.method == 'DELETE':
        try:
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], sample.image_filename)
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            current_app.logger.error(f"Error deleting file {sample.image_filename}: {e}")

        db.session.delete(sample)
        db.session.commit()
        return jsonify({'message': 'Sample deleted successfully'}), 200


@current_app.route('/api/samples/<int:sample_id>/thumbnail', methods=['GET'])
@login_required
def get_sample_thumbnail(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if sample.project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], sample.image_filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'Image file not found.'}), 404

    try:
        img = cv2.imread(filepath, cv2.IMREAD_COLOR)
        if img is None:
            raise Exception("Failed to read image with OpenCV")

        THUMBNAIL_WIDTH = 100
        height, width = img.shape[:2]
        scale = THUMBNAIL_WIDTH / width
        new_height = int(height * scale)
        thumb = cv2.resize(img, (THUMBNAIL_WIDTH, new_height), interpolation=cv2.INTER_AREA)

        is_success, buffer = cv2.imencode(".jpg", thumb)
        if not is_success:
            raise Exception("Failed to encode thumbnail")

        return send_file(
            io.BytesIO(buffer),
            mimetype='image/jpeg',
            as_attachment=False,
            download_name=f'thumbnail_{sample_id}.jpg'
        )
    except Exception as e:
        current_app.logger.error(f"Thumbnail generation failed for sample {sample_id}: {e}")
        return jsonify({'error': 'Could not generate thumbnail.'}), 500


# --- Analysis Routes ---
@current_app.route('/api/samples/<int:sample_id>/calibrate', methods=['POST'])
@login_required
def calibrate_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if sample.project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    data = request.get_json()
    if not data or 'scale_pixels_per_mm' not in data:
        return jsonify({'error': 'Missing scale_pixels_per_mm value'}), 400
    try:
        scale = float(data['scale_pixels_per_mm'])
        if scale <= 0: raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid scale value.'}), 400
    sample.scale_pixels_per_mm = scale
    db.session.commit()
    return jsonify(sample.to_dict())

@current_app.route('/api/samples/<int:sample_id>/measure', methods=['POST'])
@login_required
def measure_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if sample.project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    if not sample.scale_pixels_per_mm:
        return jsonify({'error': 'Sample must be calibrated before analysis.'}), 400

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Analysis parameters are required.'}), 400

    # Get parameters from request
    min_thresh = data.get('minThreshold', 0)
    max_thresh = data.get('maxThreshold', 255)
    min_diameter_um = data.get('minGrainDiameter', 0)

    # --- Image Processing Pipeline ---
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], sample.image_filename)
    img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return jsonify({'error': 'Could not read image file.'}), 400

    # 1. Preprocessing (simple blur for now)
    blurred = cv2.GaussianBlur(img, (5, 5), 0)

    # 2. Thresholding
    _, thresh_img = cv2.threshold(blurred, min_thresh, max_thresh, cv2.THRESH_BINARY)

    # 3. Find Contours
    contours, _ = cv2.findContours(thresh_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # 4. Filter Contours
    scale = sample.scale_pixels_per_mm
    min_diameter_px = (min_diameter_um / 1000.0) * scale

    filtered_contours = []
    for contour in contours:
        area_px = cv2.contourArea(contour)
        if area_px == 0: continue
        equiv_diameter_px = 2 * np.sqrt(area_px / np.pi)
        if equiv_diameter_px >= min_diameter_px:
            filtered_contours.append(contour)

    # 5. Perform Measurements
    measurements = []
    for i, contour in enumerate(filtered_contours):
        area_px = cv2.contourArea(contour)
        if len(contour) < 5: continue # Ellipse fitting requires at least 5 points
        (x, y), (MA, ma), angle = cv2.fitEllipse(contour)
        measurements.append({
            'grain_id': i + 1,
            'area_px': area_px,
            'area_mm2': area_px / (scale ** 2),
            'perimeter_mm': cv2.arcLength(contour, True) / scale,
            'equiv_diameter_mm': 2 * np.sqrt((area_px / (scale ** 2)) / np.pi),
            'orientation_deg': angle,
            'center_x_px': x,
            'center_y_px': y,
        })

    # 6. Save results
    if not isinstance(sample.results, dict): sample.results = {}
    sample.results['contours'] = [c.tolist() for c in filtered_contours]
    sample.results['measurements'] = measurements
    # Clear old ASTM result if it exists, as it's now invalid
    if 'astm_g' in sample.results:
        del sample.results['astm_g']

    flag_modified(sample, "results")
    db.session.commit()

    return jsonify(sample.to_dict())

@current_app.route('/api/samples/<int:sample_id>/astm-e112', methods=['POST'])
@login_required
def astm_e112_planimetric(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if sample.project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    data = request.get_json()
    if not data or 'magnification' not in data:
        return jsonify({'error': 'Magnification is required.'}), 400
    try:
        magnification = float(data['magnification'])
        if magnification <= 0: raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid magnification value.'}), 400
    if not sample.results or 'measurements' not in sample.results:
        return jsonify({'error': 'Measurements must be calculated first.'}), 400
    if not sample.scale_pixels_per_mm:
        return jsonify({'error': 'Sample must be calibrated first.'}), 400
    if not sample.results.get('image_width_px') or not sample.results.get('image_height_px'):
        return jsonify({'error': 'Image dimensions not found.'}), 400
    image_width_px = sample.results['image_width_px']
    image_height_px = sample.results['image_height_px']
    total_area_mm2 = (image_width_px * image_height_px) / (sample.scale_pixels_per_mm ** 2)
    num_grains = len(sample.results['measurements'])
    n_mm2 = num_grains / total_area_mm2
    n_in2 = n_mm2 * 645.16
    N_A = n_in2 * ((magnification / 100.0) ** 2)
    if N_A <= 0:
        return jsonify({'error': 'Cannot calculate ASTM for zero grain density.'}), 400
    G = (np.log2(N_A)) + 1
    if not isinstance(sample.results, dict): sample.results = {}
    sample.results['astm_g'] = G
    sample.results['astm_n_a'] = N_A
    flag_modified(sample, "results")
    db.session.commit()
    return jsonify(sample.to_dict())

@current_app.route('/api/samples/<int:sample_id>/multiphase', methods=['POST'])
@login_required
def multiphase_analysis(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if sample.project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    data = request.get_json()
    if not data or 'threshold' not in data:
        return jsonify({'error': 'Threshold value is required.'}), 400
    try:
        threshold_value = int(data['threshold'])
        if not (0 <= threshold_value <= 255): raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid threshold value.'}), 400
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], sample.image_filename)
    img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
    if img is None: return jsonify({'error': 'Could not read image file.'}), 400
    _, binary_img = cv2.threshold(img, threshold_value, 255, cv2.THRESH_BINARY)
    total_pixels = img.size
    phase_1_pixels = cv2.countNonZero(binary_img)
    _, buffer = cv2.imencode('.png', binary_img)
    if not isinstance(sample.results, dict): sample.results = {}
    sample.results['multiphase'] = {
        'threshold': threshold_value,
        'phase_1_percent': (phase_1_pixels / total_pixels) * 100,
        'phase_2_percent': ((total_pixels - phase_1_pixels) / total_pixels) * 100,
        'preview_image': f"data:image/png;base64,{base64.b64encode(buffer).decode('utf-8')}"
    }
    flag_modified(sample, "results")
    db.session.commit()
    return jsonify(sample.to_dict())


@current_app.route('/api/samples/<int:sample_id>/preview', methods=['POST'])
@login_required
def preview_threshold(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if sample.project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request must contain parameters.'}), 400

    min_thresh = data.get('min_threshold', 0)
    max_thresh = data.get('max_threshold', 255)

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], sample.image_filename)
    img = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return jsonify({'error': 'Could not read image file.'}), 400

    # Apply simple binary thresholding. This can be expanded later.
    _, binary_img = cv2.threshold(img, min_thresh, max_thresh, cv2.THRESH_BINARY)

    is_success, buffer = cv2.imencode(".png", binary_img)
    if not is_success:
        return jsonify({'error': 'Failed to encode preview image.'}), 500

    img_base64 = base64.b64encode(buffer).decode('utf-8')

    return jsonify({'preview_image': f"data:image/png;base64,{img_base64}"})


# --- Manual Editing Routes ---
@current_app.route('/api/samples/<int:sample_id>/retouch', methods=['POST'])
@login_required
def retouch_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if sample.project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    data = request.get_json()
    if not data or 'contours' not in data:
        return jsonify({'error': 'Request must contain contours.'}), 400
    if not isinstance(sample.results, dict): sample.results = {}
    sample.results['contours'] = data['contours']
    if 'measurements' in sample.results: del sample.results['measurements']
    flag_modified(sample, "results")
    db.session.commit()
    return jsonify(sample.to_dict())

@current_app.route('/api/actions/split-contour', methods=['POST'])
def split_contour():
    data = request.get_json()
    if not data or 'contour' not in data or 'line' not in data:
        return jsonify({'error': 'Request must contain a contour and a line.'}), 400
    try:
        contour_points = data['contour']
        if contour_points[0] != contour_points[-1]: contour_points.append(contour_points[0])
        polygon = Polygon(contour_points)
        line = LineString(data['line'])
        split_polygons = polygon.difference(line.buffer(0.001))
        if split_polygons.is_empty: return jsonify({'error': 'Splitting resulted in empty geometry.'}), 400
        polygons = [split_polygons] if split_polygons.geom_type == 'Polygon' else list(split_polygons.geoms)
        new_contours_json = [np.array(p.exterior.coords, dtype=np.int32).reshape((-1, 1, 2)).tolist() for p in polygons]
        return jsonify({'new_contours': new_contours_json})
    except Exception as e:
        current_app.logger.error(f"Error splitting contour: {e}")
        return jsonify({'error': 'An internal error occurred.'}), 500

# --- Export Routes ---
@current_app.route('/api/samples/<int:sample_id>/export/csv', methods=['GET'])
@login_required
def export_csv(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if sample.project.user_id != current_user.id:
        return jsonify({'error': 'Not authorized'}), 403
    if not sample.results or 'measurements' not in sample.results:
        return jsonify({'error': 'No measurement data to export.'}), 404
    df = pd.DataFrame(sample.results['measurements'])
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return send_file(io.BytesIO(buffer.getvalue().encode()), mimetype='text/csv', as_attachment=True, download_name=f'sample_{sample.id}_measurements.csv')


# --- File Serving ---
@current_app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)
