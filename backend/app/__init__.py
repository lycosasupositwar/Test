from flask import Flask, send_from_directory
from flask_cors import CORS
from .models import db
import os

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Configure database
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///../instance/default.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = 'uploads'

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Ensure the upload folder exists
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])

    db.init_app(app)

    with app.app_context():
        from . import routes
        db.create_all()

    # Route to serve uploaded images
    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        # Use an absolute path for the directory
        return send_from_directory(os.path.join(os.getcwd(), app.config['UPLOAD_FOLDER']), filename)

    return app
