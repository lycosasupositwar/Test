from flask import Flask, send_from_directory
from flask_cors import CORS
from .models import db
import os

def create_app():
    app = Flask(__name__)
    # Use a simpler, global CORS configuration for debugging
    CORS(app)

    # Configure database
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:////data/metallobox.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Define an absolute path for uploads inside the container
    app.config['UPLOAD_FOLDER'] = '/app/uploads'

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
        # Use a robust absolute path
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    return app
