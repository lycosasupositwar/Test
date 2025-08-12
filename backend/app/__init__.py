from flask import Flask
from flask_cors import CORS
from flask_login import LoginManager
from .models import db, User
import os

def create_app():
    app = Flask(__name__)
    CORS(app, origins=os.environ.get("CORS_ORIGIN", "http://localhost:8080"), supports_credentials=True)

    # Configure secret key for session management
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a-super-secret-key-for-development')

    # Configure database
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:////data/metallobox.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Define an absolute path for uploads inside the container
    app.config['UPLOAD_FOLDER'] = '/app/uploads'

    # Ensure the upload folder exists
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])

    db.init_app(app)

    # Initialize Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        return User.query.get(int(id))

    with app.app_context():
        from . import routes
        db.create_all()

    return app
