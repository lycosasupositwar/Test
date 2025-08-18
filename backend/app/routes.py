from flask import current_app, request, jsonify, send_file, send_from_directory
from .models import db, Project, Sample
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
import matplotlib
matplotlib.use('Agg') # Use a non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from scipy.spatial import Voronoi, voronoi_plot_2d

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

# --- Sample Routes ---
@current_app.route('/api/projects/<int:project_id>/samples', methods=['GET'])
def get_samples_for_project(project_id):
    Project.query.get_or_404(project_id)
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

@current_app.route('/api/samples/<int:sample_id>', methods=['DELETE'])
def delete_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    try:
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], sample.image_filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        current_app.logger.error(f"Error deleting file {sample.image_filename}: {e}")
    db.session.delete(sample)
    db.session.commit()
    return jsonify({'message': 'Sample deleted successfully'}), 200

# --- Analysis Routes ---
@current_app.route('/api/samples/<int:sample_id>/calibrate', methods=['POST'])
def calibrate_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
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
def measure_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    if not sample.scale_pixels_per_mm:
        return jsonify({'error': 'Sample must be calibrated.'}), 400
    if not sample.results or 'contours' not in sample.results:
        return jsonify({'error': 'No contours found.'}), 400
    scale = sample.scale_pixels_per_mm
    contours = [np.array(c, dtype=np.int32) for c in sample.results['contours']]
    measurements = []
    for i, contour in enumerate(contours):
        if len(contour) < 5: continue
        area_px = cv2.contourArea(contour)
        (x, y), (MA, ma), angle = cv2.fitEllipse(contour)
        measurements.append({
            'grain_id': i + 1, 'area_px': area_px, 'area_mm2': area_px / (scale ** 2),
            'perimeter_mm': cv2.arcLength(contour, True) / scale,
            'equiv_diameter_mm': 2 * np.sqrt((area_px / (scale ** 2)) / np.pi),
            'orientation_deg': angle, 'center_x_px': x, 'center_y_px': y,
        })
    if not isinstance(sample.results, dict): sample.results = {}
    sample.results['measurements'] = measurements
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

@current_app.route('/api/samples/<int:sample_id>/astm-e112-intercept', methods=['POST'])
def astm_e112_intercept(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    data = request.get_json()
    if not data or 'total_line_length_px' not in data or 'total_intercepts' not in data:
        return jsonify({'error': 'Line length and intercept count are required.'}), 400
    if not sample.scale_pixels_per_mm:
        return jsonify({'error': 'Sample must be calibrated first.'}), 400

    total_length_px = data['total_line_length_px']
    total_intercepts = data['total_intercepts']

    if total_length_px <= 0 or total_intercepts <= 0:
        return jsonify({'error': 'Total line length or total intercepts must be positive.'}), 400

    total_length_mm = total_length_px / sample.scale_pixels_per_mm

    NL = total_intercepts / total_length_mm

    # ASTM E112 formula for intercept method
    G = (6.6438 * np.log10(NL)) - 3.288

    if not isinstance(sample.results, dict): sample.results = {}
    sample.results['astm_g_intercept'] = G
    flag_modified(sample, "results")
    db.session.commit()

    return jsonify({'astm_g_intercept': G})


@current_app.route('/api/samples/<int:sample_id>/multiphase', methods=['POST'])
def multiphase_analysis(sample_id):
    sample = Sample.query.get_or_404(sample_id)
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


def generate_individual_astm_charts(magnification=100.0, g_values=None):
    """
    Generates individual visual comparison charts for a list of ASTM grain sizes.
    For each G value, it creates a simulated microstructure.
    Returns a dictionary mapping G values to base64 encoded PNG strings.
    """
    if g_values is None:
        g_values = [1, 2, 3, 4]

    charts = {}

    for G in g_values:
        fig, ax = plt.subplots(1, 1, figsize=(3, 3))

        N_A_100x = 2**(G - 1)
        N_A_M = N_A_100x * (magnification / 100.0)**2

        # We generate points in a 1x1 area. To avoid edge effects, generate in a larger area and crop.
        num_points = int(N_A_M * 4) # for a 2x2 area
        if num_points < 4: num_points = 4

        points = np.random.rand(num_points, 2) * 2 - 0.5

        try:
            vor = Voronoi(points)
            voronoi_plot_2d(vor, ax=ax, show_vertices=False, line_colors='black', line_width=1, point_size=0)
        except Exception:
            ax.text(0.5, 0.5, 'Error', ha='center', va='center')

        ax.set_title(f"G = {G}")
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_aspect('equal', adjustable='box')
        fig.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format='png')
        buf.seek(0)

        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        charts[G] = f"data:image/png;base64,{img_base64}"

        plt.close(fig)

    return charts

@current_app.route('/api/samples/<int:sample_id>/astm-chart', methods=['POST'])
def get_astm_chart(sample_id):
    Sample.query.get_or_404(sample_id)
    data = request.get_json()
    if not data or 'magnification' not in data:
        return jsonify({'error': 'Magnification is required.'}), 400

    g_values = data.get('g_values', [1, 2, 3, 4]) # Default G values

    try:
        magnification = float(data['magnification'])
        if magnification <= 0: raise ValueError()

        if not all(isinstance(g, int) and 0 < g < 15 for g in g_values):
             raise ValueError("Invalid G values")

    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid magnification or G values.'}), 400

    charts = generate_individual_astm_charts(magnification, g_values)

    return jsonify(charts)

@current_app.route('/api/samples/<int:sample_id>/set-astm-comparison', methods=['POST'])
def set_astm_comparison(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    data = request.get_json()
    if not data or 'astm_g_comparison' not in data:
        return jsonify({'error': 'astm_g_comparison value is required.'}), 400

    try:
        g_value = int(data['astm_g_comparison'])
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid G value.'}), 400

    if not isinstance(sample.results, dict):
        sample.results = {}

    sample.results['astm_g_comparison'] = g_value
    flag_modified(sample, "results")
    db.session.commit()

    return jsonify(sample.to_dict())


# --- Manual Editing Routes ---
@current_app.route('/api/samples/<int:sample_id>/retouch', methods=['POST'])
def retouch_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
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
def export_csv(sample_id):
    sample = Sample.query.get_or_404(sample_id)
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
