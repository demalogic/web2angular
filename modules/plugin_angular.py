__author__ = 'nihil'

from gluon import *
from gluon.serializers import json
from operator import *
import traceback, sys
mmin = min
mmax = max

class Message(Exception):
    def __init__(self,title,message = None):
        super(Exception,self).__init__()
        self.title, self.message = title, message or title

    def __str__(self):
        return '%s\n%s' % (self.title, self.message)

def jsoned(func):
    from gluon.serializers import json
    def x():
        try:
            ret = func()
            current.response.headers['Content-Type'] = 'application/json'
            if hasattr(ret,'as_json'):
                return ret.as_json()
            return json(ret)
        except Exception as e:
            if type(e) is Message:
                raise HTTP(512,'%s\n%s' % (e.title,e.message))
            if current.globalenv.get('debug'):
                raise HTTP(511, json(dict(exception = str(e), traceback = '\n'.join(traceback.format_tb(sys.exc_info()[2])))))
            else:
                raise e
    x.__name__ = func.__name__
    return x

class ResourceManager(object):
    _instance = None
    __resources = {}

    resource = __resources.get

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = object.__new__(cls)
        return cls._instance

    def get_resources(self):
        return self.__resources.keys()

    def register(self,resource, name):
        self.__resources[name] = resource
#
#
class Resource(object):

    def __init__(self,name):
        ResourceManager().register(self,name)

def unallowed(*args,**kwargs):
    raise HTTP(401,'Not allowed')

for func_name in ('get','put','post','delete'):
    setattr(Resource,func_name, unallowed)


class TableResource(Resource):
    doc = None

    def __init__(self, table):
        super(TableResource,self).__init__(table._tablename)
        self.table = table
        self.__doc__ = self.table._tablename
        self.name = self.__doc__ = self.table._tablename

    def get(self,id):
        """
        fetch a single object from table identifyed by ID
        """
        return self.table(id)

    def list(self,fields = None, selection= None):
        """
        Fetch a list of resource and return generic description of items
        """
        if fields:
            fields = tuple(self.table[field_name] for field_name in fields)
        query = None
        if selection:
            query = self.table.id > 0
        records = self.table._db(query).select(*(fields or [self.table.ALL]))
        return dict(
            results = records,
            totalResults = len(records),
        )

    def put(self,multiple = None,**kwargs):
        if 'id' in kwargs:
            id = kwargs.pop('id')
            ret = self.table.validate_and_update(id,**kwargs)
            ret.id = id
        else:
            ret = self.table.validate_and_insert(**kwargs)
        if ret.errors:
            return ret
        return self.table[ret.id]

    def describe(self):
        model = self.table
        return dict(
            fields = dict((field.name,dict(
                name = field.label,
                validators = ValidatorSerializer(field.requires if isSequenceType(field.requires) else [field.requires])(),
                comment = field.comment,
                readable = field.readable,
                writable = field.writable,
                type = field.type.split('(')[0],
                w2pwidget = field.widget,
            )) for field in (
                getattr(model,field)
                for field in model.fields
            )
            if field.readable or field.writable),
            doc = self.doc or self.__doc__,
        )

    def delete(self,id=None, **kwargs):
        return self.table._db(self.table.id == id).delete()


class MasterResource(Resource):
    """
    Manage all resources
    """
    def __init__(self):
        super(MasterResource,self).__init__('resources')
        self.name = 'Resource'

    def get(self,resource_name):
        # getting resource
        resource = ResourceManager().resource(resource_name)
        if resource:
            #build return dictionary
            return dict(
                name = resource.name,
                doc = resource.__doc__,
                methods = tuple(
                    dict(
                        name = method_name,
                        doc = method.__doc__,
                    )
                    for method_name, method in resource.__dict__.iteritems() if isCallable(method)
                )
            )
        raise HTTP(404, 'resource known as %s not found on this server' % resource_name)

    def list(self):
        return ResourceManager().get_resources()

MasterResource()


class ValidatorSerializer:
    # TODO: completare i validatori
    def __init__(self, validators):

        self._serializers = {}

        for validator in validators:
            validator_name = type(validator).__name__
            validator_method = getattr(self,'serialize_%s' % validator_name,None)
            if validator_method:
                self._serializers.update(validator_method(validator, **self._serializers))

    def serialize_IS_LENGTH(self, validator, minlength = 0, maxlength = 2**32):
        return dict(
            minlength = max(minlength, validator.minsize),
            maxlength = min(maxlength, validator.maxsize),
        )

    def serialize_IS_INT_IN_RANGE(self,validator,min=0, max=2**32, **kwargs):
        return dict(
            min = mmax(min, validator.minimum),
            max = mmin(max, validator.maximum),
        )

    def serialize_IS_NOT_EMPTY(self,validator, required=False, **kwargs):
        return dict(required = True)

    def serialize_IS_MATCH(self,validator,pattern = '',**kwargs):
        return dict(pattern=('(%s)|(%s)' % (regex2js(validator.regex.pattern),pattern)) if pattern else regex2js(validator.regex.pattern))

    def serialize_IS_ALPHANUMERIC(self,validator,pattern='',**kwargs):
        return self.serialize_IS_MATCH(validator, pattern)

    def serialize_IS_IN_DB(self,validator,reference=''):
        return dict(reference = validator.label)


    def __call__(self):
        return self._serializers

def regex2js(pattern):
    """
    translate a python regex to javascript regex
    :param pattern: string: Pyhton regex patter
    :return: string: javascript regex pattern
    """
    # TODO: costruire un buon risolutore di espressioni regolari per javascript
    return pattern


# class ResourceManager(object):
#     _instance = None
#     __resources = {}
#
#     resource = __resources.get
#
#     def __new__(cls, *args, **kwargs):
#         if not cls._instance:
#             cls._instance = object.__new__(cls,*args, **kwargs)
#         return cls._instance
#
#     def register(self,resource, name):
#         self.__resources[name] = resource
#


# class ResourceMeta(type):
#     def __new__(cls, name, mro, d):
#         def not_allowed(*args,**kwargs):
#             return HTTP(401,'method not allowed here')
#
#         for func in ('get','put','post'):
#             d.setdefault(func,not_allowed)
#         ret = type(name,mro,d)
#
#         ResourceManager().register(ret, name)
#         return ret
#
# class TableResource(object):
#
#     def __init__(self,table):
#         self.db_name = table._db
#         self.table = table
#
#     def get(self,fields = None, **kwargs):
#         db = current.globalenv[self.db_name]
#         ret = db().select(self.table.ALL)
#         return ret
#
# class Person(TableResource):
#     __metaclass__ = ResourceMeta
#     table = db.person
