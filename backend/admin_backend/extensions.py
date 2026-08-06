from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm.decl_api import _declarative_constructor

class Base(DeclarativeBase):
    def __init__(self, **kwargs):
        _declarative_constructor(self, **kwargs)

db = SQLAlchemy(model_class=Base)


