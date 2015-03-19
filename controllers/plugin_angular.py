__author__ = 'nihil'

from plugin_angular import jsoned, Message, ResourceManager, ValidatorSerializer,Resource, TableResource
from operator import *
from itertools import *


import re
re_format_fields = re.compile('%\((\S+)\)\w')

def field_from_format(tab):
    """
    find fields from format of a table and returns the list of fields who build it
    :param tab: gluon.dal.Table object
    :return: list o fields composing table format string
    """
    fields = itemgetter(*re_format_fields.findall(tab._format))(tab)
    if type(fields) is not tuple:
        fields = (fields,)
    return fields + (tab._id,)

def _is_many(join):
    dest = join.first
    condition = join.second
    if condition.first.table == dest:
        middle = condition.second
    else:
        middle = condition.first
    return not middle.type.startswith('reference')

def is_many(join):
    """
    Determine if a join chain represents a <to many> relation or not
    :param join:
    :return:
    """
    if type(join) not in (tuple,list):
        join = [join]
    return any(imap(_is_many,join))

from functools import partial
class AggregateQueryResource(Resource):
    def __init__(self,name,main_table,aggregate_joins, permissions={}, doc=''):
        """
        Defines a Resource handler for join based aggregation
        :param main_table: main entitiy table
        :param aggregate_joins: list of join from main_table to aggregate table
        """
        DEFAULT_PERMISSIONS = dict(get='read',list='read',put='write',delete='delete')
        super(AggregateQueryResource,self).__init__(name)
        self.main_table = main_table
        self.doc = doc or self.__doc__
        self.aggregates = tuple(
            (table,
                join, # join to get single table
                tuple(field for field in attrgetter(*table.fields)(table) if field.readable or field.writable), # useful fields from joined table
                is_many(join), # check if is a many relation
                join.second.first.name if join.second.first.table == self.main_table and not is_many(join) else join.second.second.name, # main table field who points on aggregates
            ) for table,join in
            ((join[-1].first if type(join) in (tuple,list) else join.first,join) for join in aggregate_joins) # splits each join to get (TABLE, and Join chain)
        )

        # storing many to many relations
        self._many_to_many = dict(map(itemgetter(0,3),self.aggregates))

        # excluding not managed fields (who is not readable nor writable)
        self.default_fields = tuple(field for field in attrgetter(*self.main_table.fields)(self.main_table) if field.readable or field.writable)
        # setting permissions to check for each method
        self.permissions = DEFAULT_PERMISSIONS.copy()
        self.permissions.update(permissions)

        # creating references user can ask for by withreference option
        self.ref_tables = {}
        for tab_ref in self.main_table._references:
            if tab_ref.readable or tab_ref.writable:
                self.ref_tables.setdefault(tab_ref.referent._table,set()).add(tab_ref)

        # removing references where are aggregates references to the same model
        for model in map(itemgetter(0),self.aggregates):
            self.ref_tables.pop(model,'')

        # prefetching references format
        self.ref_query_format = dict((table,tuple(field for field in field_from_format(table))) for table in self.ref_tables)

    def get(self,id):
        """
        Search a single object from main table and returns a dict representing object with its aggregate objects
        :param id: primary key of main object
        :return:
        """
        obj = self.main_table[id].as_dict()
        db = self.main_table._db
        if obj:
            for table, join, fields, many, field in self.aggregates:
                if  many:
                    obj[table._tablename + '_set'] = db(self.main_table._id == id).select(*fields,join=join).as_list()
                else:
                    obj['_' + table._tablename] = db(self.main_table._id == id).select(*fields,join=join).first()
        return obj

    def list(self,fields = None, filter= None,withreferences=False):
        """
        Search for a object from from main table and returns a dict representing object with its aggregate objects
        :param fields: optional fields you wants to receive
        :param filter: optional dict of filtering in a=b form
        :param withreferences: boolean need to know if you wants also referenced objects
        :return:
        """
        db = self.main_table._db
        if filter:
            names, values = zip(*filter.items())
            # extracting child filter

            _fields = attrgetter(*names)(self.main_table)
            query = db(all((field == value) for field ,value in zip(_fields,values)))
        else:
            query = db()
        # adjusfing fields
        if fields:
            fields = attrgetter(*chain(fields,(self.main_table._id.name,)))(self.main_table)
        else:
            fields = self.default_fields
        objects = query.select(*fields).as_dict()

        # fetching aggregates objects
        aggregates = {}
        for table, join, fields, is_many, field in self.aggregates:
            aggregs = db(self.main_table._id.belongs(set(map(itemgetter(table._id.name if is_many else field),objects.itervalues())))).select(*fields,join=join).as_list()
            if is_many:
                # creaing field on results
                key = table._tablename + '_set'
                for record in objects.itervalues():
                    record[key] = []
                # linking all aggregates to its record
                for row in aggregs:
                    objects[row[field]][key].append(row)
            else:
                aggregs = dict((x['id'],x) for x in aggregs)
                # linking all record to its aggregate
                for record in objects.values():
                    record[field] = aggregs.get(record[field])

        # if you wants references to other objects I will do a query for every model asking by primary key
        if withreferences:
            references = dict(
                (tab._tablename,dict((row.id,tab._format % row ) for row in self.main_table._db(tab.id.belongs(set(chain(*imap(objects.column,field_names))).difference((None,)))).select(*self.ref_query_format[tab])))
                for tab,fields, field_names in ((k,v, map(attrgetter('name'),v)) for k,v in self.ref_tables.items())
            )
        else:
            references = {}
        # building result object
        return dict(
            results = objects.values(),
            references = references,
            totalResults = len(objects),
        )

    def put(self,multiple = None,**kwargs):
        id = self.main_table._id.name
        if id in kwargs:
            id = kwargs.pop(id)
            ret = self.main_table.validate_and_update(id,**kwargs)
            ret.id = id
        else:
            ret = self.main_table.validate_and_insert(**kwargs)
        if ret.errors:
            return ret
        return self.get(ret.id)

    def describe(self, _model=None, join=None):
        model = _model or self.main_table
        ret = dict(
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
            doc = self.doc,
            representation = re_format_fields.findall(model._format),
            )
        # if not _model:
        #     for table,join,fields,is_many, field in self.aggregates:
        #         if is_many:
        #             rep = self.describe(table,join)
        #             rep['cardinality'] = 'many'
        #             ret['fields'][table._tablename + '_set'] = rep
        #         else:
        #             rep = self.describe(table,join)
        #             rep['cardinality'] = 'single'
        #             ret['fields']['_' + table._tablename] = rep
        return ret

    def delete(self,id=None, **kwargs):
        return self.main_table._db(self.main_table._id == id).delete()

AggregateQueryResource('ABC',db.bb,[db.aa.on(db.bb.aa == db.aa.id),db.cc.on(db.bb.id == db.cc.bb)])
TableResource(db.aa)
TableResource(db.cc)
TableResource(db.bb)


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

# @jsoned
# def restful():
#     # return BEAUTIFY(request)
#     if len(request.args)<1:
#         raise HTTP(401,'Resource not defined. please use /%s/%s/restful/<resource name>[/arguments]' % (request.application, request.controller))
#     # get resource name and consume args
#     resource_name = request.args.pop(0)
#     # get method name and consume args
#     method_name = request.env.request_method.lower()
#     # fetching resource object
#     resource = ResourceManager().resource(resource_name)
#     if not resource:
#         raise HTTP(404,'resource %s not found on this %s.' % (resource_name,request.application))
#     method = getattr(resource,method_name,None)
#     if not method:
#         raise HTTP(404, 'method unknown')
#     return method(*request.args,**request.vars)
