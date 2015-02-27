__author__ = 'nihil'

from plugin_angular import jsoned, Message, ResourceManager, ValidatorSerializer
from operator import isSequenceType
from itertools import chain, imap



@jsoned
def model():
    if not request.args:
        raise Message('you have to specify a model like by /%s/plugin_angular/model/<model_name>' % request.application)
    if not request.args[0] in db:
        raise Message('model %s not found on %s application' % (request.args[0],request.application))
    model = db[request.args[0]]
    return dict((field.name,dict(
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
    ))

@jsoned
def restful():
    # return BEAUTIFY(request)
    if len(request.args)<2:
        raise HTTP(401,'Resource not defined. please use /%s/%s/restful/<resource name>[/arguments]' % (request.application, request.controller))
    # get resource name and consume args
    resource_name = request.args.pop(0)
    # get method name and consume args
    method_name = request.args.pop(0)
    # fetching resource object
    resource = ResourceManager().resource(resource_name)
    if not resource:
        raise HTTP(404,'resource %s not found on this %s.' % (resource_name,request.application))
    method = getattr(resource,method_name,None)
    if not method:
        raise HTTP(404, 'method unknown')
    return method (*request.args,**request.vars)

