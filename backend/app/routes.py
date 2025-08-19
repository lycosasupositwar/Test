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

def calculate_g(nl):
    if nl <= 0:
        return None
    return (6.6438 * np.log10(nl)) - 3.288

@current_app.route('/api/samples/<int:sample_id>/astm-e112-intercept', methods=['POST'])
def astm_e112_intercept(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Missing request data.'}), 400
    if not sample.scale_pixels_per_mm:
        return jsonify({'error': 'Sample must be calibrated first.'}), 400

    scale = sample.scale_pixels_per_mm
    test_type = data.get('test_type', 'lines') # Default to 'lines' for old requests

    results = {}
    if test_type == 'lines':
        required_keys = ['h_intercepts', 'h_length_px', 'v_intercepts', 'v_length_px']
        if not all(key in data for key in required_keys):
            return jsonify({'error': 'Missing required line intercept data.'}), 400

        h_intercepts = data['h_intercepts']
        h_length_mm = data['h_length_px'] / scale
        v_intercepts = data['v_intercepts']
        v_length_mm = data['v_length_px'] / scale

        nl_h = h_intercepts / h_length_mm if h_length_mm > 0 else 0
        nl_v = v_intercepts / v_length_mm if v_length_mm > 0 else 0
        total_intercepts = h_intercepts + v_intercepts
        total_length_mm = h_length_mm + v_length_mm
        nl_global = total_intercepts / total_length_mm if total_length_mm > 0 else 0

        results = {
            'astm_g_intercept_h': calculate_g(nl_h),
            'astm_g_intercept_v': calculate_g(nl_v),
            'astm_g_intercept_global': calculate_g(nl_global)
        }
    elif test_type == 'circles':
        required_keys = ['total_length_px', 'intercept_count', 'junction_count']
        if not all(key in data for key in required_keys):
            return jsonify({'error': 'Missing required circle intercept data.'}), 400

        total_length_mm = data['total_length_px'] / scale
        intercept_count = data['intercept_count']
        junction_count = data['junction_count']

        # Per ASTM E112, junctions count as 1.5 intercepts
        effective_intercepts = intercept_count + (1.5 * junction_count)
        nl_circles = effective_intercepts / total_length_mm if total_length_mm > 0 else 0

        results = {
            'astm_g_intercept_circles': calculate_g(nl_circles)
        }
    else:
        return jsonify({'error': 'Invalid test_type specified.'}), 400

    if not isinstance(sample.results, dict):
        sample.results = {}

    sample.results.update(results)
    flag_modified(sample, "results")
    db.session.commit()

    return jsonify(results)


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


def lloyds_relaxation(points, bounds, iterations=5):
    """Applies Lloyd's algorithm to a set of points."""
    for _ in range(iterations):
        vor = Voronoi(points)
        new_points = []
        for i in range(len(vor.points)):
            region = vor.regions[vor.point_region[i]]
            if -1 in region: # Some regions can be open
                new_points.append(points[i])
                continue

            polygon = [vor.vertices[j] for j in region]

            # Check if polygon is outside bounds, if so, keep original point
            if not all(0 <= p[0] <= bounds[0] and 0 <= p[1] <= bounds[1] for p in polygon):
                new_points.append(points[i])
                continue

            # Calculate centroid
            sx, sy, area = 0.0, 0.0, 0.0
            for k in range(len(polygon)):
                x0, y0 = polygon[k]
                x1, y1 = polygon[(k+1) % len(polygon)]
                cross_product = (x0 * y1) - (x1 * y0)
                area += cross_product
                sx += (x0 + x1) * cross_product
                sy += (y0 + y1) * cross_product

            if area == 0:
                new_points.append(points[i])
                continue

            area *= 0.5
            sx /= (6.0 * area)
            sy /= (6.0 * area)
            new_points.append([sx, sy])

        points = np.array(new_points)
    return points

def generate_individual_astm_charts(magnification, width_px, height_px, g_values=None):
    """
    Generates individual visual comparison charts for a list of ASTM grain sizes,
    sized to match the original image, with a more realistic appearance.
    """
    if g_values is None:
        g_values = [1, 2, 3, 4]

    charts = {}

    base_points_per_unit_area = 50

    for G in g_values:
        N_A_100x = 2**(G - 1)
        point_density = N_A_100x * (magnification / 100.0)**2
        num_points = int(point_density * (width_px * height_px) / (1000**2))

        if num_points < 4: num_points = 4
        if num_points > 2000: num_points = 2000

        # Generate points and relax them using Lloyd's algorithm
        points = np.random.rand(num_points, 2) * np.array([width_px, height_px])
        points = lloyds_relaxation(points, (width_px, height_px), iterations=3)

        dpi = 100
        fig_width_in = width_px / dpi
        fig_height_in = height_px / dpi

        fig, ax = plt.subplots(figsize=(fig_width_in, fig_height_in), dpi=dpi)

        # Plot the final, relaxed Voronoi diagram
        vor = Voronoi(points)

        # Fill polygons (grains)
        for region_index in vor.point_region:
            region = vor.regions[region_index]
            if -1 not in region:
                polygon = [vor.vertices[i] for i in region]
                # Use a random grayscale color for each grain
                gray_level = np.random.uniform(0.6, 0.9)
                ax.fill(*zip(*polygon), color=str(gray_level), edgecolor='none')

        # Draw grain boundaries
        voronoi_plot_2d(vor, ax=ax, show_vertices=False, line_colors='black', line_width=1.5, point_size=0)

        ax.set_title(f"G = {G} @ {magnification}X")
        ax.set_xlim(0, width_px)
        ax.set_ylim(0, height_px)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_aspect('equal', adjustable='box')
        plt.axis('off')
        fig.subplots_adjust(left=0, right=1, top=1, bottom=0)

        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
        buf.seek(0)

        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        charts[G] = f"data:image/png;base64,{img_base64}"

        plt.close(fig)

    return charts

@current_app.route('/api/samples/<int:sample_id>/astm-chart', methods=['POST'])
def get_astm_chart(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    data = request.get_json()

    if not data or 'magnification' not in data:
        return jsonify({'error': 'Magnification is required.'}), 400

    g_values = data.get('g_values', [1, 2, 3, 4])
    width_px = sample.results.get('image_width_px')
    height_px = sample.results.get('image_height_px')

    if not width_px or not height_px:
        return jsonify({'error': 'Image dimensions not found in sample data.'}), 400

    try:
        magnification = float(data['magnification'])
        if magnification <= 0: raise ValueError()

        if not all(isinstance(g, int) and 0 < g < 15 for g in g_values):
             raise ValueError("Invalid G values")

        charts = generate_individual_astm_charts(magnification, width_px, height_px, g_values)
        return jsonify(charts)

    except ValueError as e:
        return jsonify({'error': 'Invalid magnification or G values.'}), 400
    except Exception as e:
        current_app.logger.error(f"Error generating ASTM chart: {e}")
        return jsonify({'error': 'An internal error occurred while generating charts.'}), 500

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
