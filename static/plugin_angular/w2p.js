/**
 * Created by nihil on 25/02/15.
 */
/**
 * Created by nihil on 02/02/15.
 */

var AJS2W2P_TYPES = {
    string:     'text',
    text:   	'text',
    boolean:    'checkbox',
    integer:    'number',
    double:     'number',
    decimal:    'number',
    date:       'date',
    time:       'time',
    datetime:   'datetime-local',
    password:   'password',
    upload:     '',
    float:      'number',
    reference:  '',
    referenced: ''
};

var AJS2W2P_TYPES_TEMPLATE = {
    text:   	'text',
    upload:     'upload',
    reference:  'reference',
    referenced: 'references'
};

(function(){
    var app = angular.module('web2angular',['ui.bootstrap']);

	app.config(function($interpolateProvider) {
		$interpolateProvider.startSymbol('{*');
		$interpolateProvider.endSymbol('*}');
	});

    app.service('w2p', function ($http, $modal, $rootScope) {
        this.post = function (func, data) {
            url = '/' + $rootScope.options.application + '/' + func;
            ret = $http.post(url, data);
            ret.error(function (data, status, evt, xhr) {
                instance = $modal.open({
                    templateUrl: '/' + $rootScope.options.application + '/static/plugin_angular/templates/' + ((status==512)?'message.html':'error.html'),
                    size: 'lg',
                    controller: function ($modal, $scope) {
                        if (status == 512){
                            mex = data.split('\n');
                            $scope.title = mex[0];
                            $scope.message = mex[1];
                        } else {
                            try {
                                if ('traceback' in data) {
                                    $scope.traceback = data.traceback;
                                    $scope.exception = data.exception;
                                }
                            } catch (e) {
                                $scope.exception = 'Ticket';
                                $scope.message = data;
                            }
                        }
                        $scope.cancel = function () {
                            $modal.instance.dismiss();
                        };
                    },
                    controlerAs: 'ctrl'
                });
                $modal.instance = instance;
            });
            return ret;
        };
        this.get = this.post;
    });

    app.service('w2pResources',function($http,$rootScope,$modal){
        //this.resourceCache = {};
        var MANAGEERROR = function(data){
            instance = $modal.open({
                templateUrl: '/' + $rootScope.options.application + '/static/plugin_angular/templates/' + ((status==512)?'message.html':'error.html'),
                size: 'lg',
                controller: function ($modal, $scope) {
                    if (status == 512){
                        mex = data.split('\n');
                        $scope.title = mex[0];
                        $scope.message = mex[1];
                    } else {
                        try {
                            if ('traceback' in data) {
                                $scope.traceback = data.traceback;
                                $scope.exception = data.exception;
                            }
                        } catch (e) {
                            $scope.exception = 'Ticket';
                            $scope.message = data;
                        }
                    }
                    $scope.cancel = function () {
                        $modal.instance.dismiss();
                    };
                },
                controlerAs: 'ctrl'
            });
            $modal.instance = instance;
        };
        var W2P_POST = function (resource,method,data,success, scope, options){
            if (scope)
                scope.waiting = true;
            return $http.post('/' + $rootScope.options.application + '/plugin_angular/restful/' + resource + '/' + method,data, options)
                .success(function(data, status,xhr,config) {
                    success.apply(this, [data,status,xhr,config]);
                    if(scope)
                        scope.waiting = false;
                })
                .error(function(data){
                    MANAGEERROR(data);
                    if(scope)
                        scope.waiting = false;
                });
        };
        var W2PRESOURCE = this;
        var IDB = {}; // table -> index -> data
        var UNLINKED = {}; // table -> id_list
        var UNLINKED_MODELS = [];

        this.IDB = IDB;

        var makeIndex = function(list,field_name){
            result = {};
            if (!field_name) field_name = 'id';
            for (i in list){
                var item = list[i];
                result[item[field_name]] = item;
            }
            return result;
        };
        var copyAttrs = function(source, dest){
            for (x in source){
                dest[x] = source[x];
            }
        };
        var setAdd = function(S,x){
            if (-1 == $.inArray(x,S)){
                S.push(x);
            }
        };
        var setUpdate = function(S,x){
            index = $.inArray(x,S);
            if (index == -1){
                S.push(x);
            } else {
                S[index] = x;
            }
        };
        var setIDUpdate = function(S,x){
            var r = true;
            var id = x.id;
            for (o = 0; r && (o < S.length);o++){
                if (S[o].id == id){
                    r = false;
                    copyAttrs(x,S[o]);
                }
            }
            if (r){
                S.push(x);
            }
        };
        var linkModel = function(ref){
            var Klass = ref.klass;
            var referModel = W2PRESOURCE.modelCache[ref.to];
            var local_ref = ref.id;
            var ext_ref = ref.to;

            // link many to one
            if (!(('_' + ref.id) in Klass.prototype)) {
                Object.defineProperty(Klass.prototype, '_' + ref.id, {
                    get: function () {
                        try {
                            return IDB[ext_ref][this[local_ref]];
                        } catch (e) {
                            if (!(this._modelName in UNLINKED))
                                UNLINKED[this._modelName] = [];
                            UNLINKED[this._modelName].push(this[local_ref]);
                            return undefined;
                        }
                    }
                });
            }
        };
        var makeModelClass = function(model){
            var _model = model;
            var Klass = function(row) {
                for (var x in Klass._ref_translations){
                    row[Klass._ref_translations[x]] = row[x];
                    delete row[x];
                }
                for (x in Klass._inverse_references){
                    row[Klass._inverse_references[x]] = [];
                }
                copyAttrs(row,this);
            };

            Klass._ref_translations = {};
            Klass._modelName = model.name;
            Klass._represent_fields = model.representation;
            Klass._references = model.references.map(function(x){return x.id});
            Klass._inverse_references = model.referencedBy.map(function(x){return x.by + '_' + x.id + '_set'});
            Klass._referents = model.referencedBy.map(function(x){ return [x.by, x.id] });
            W2PRESOURCE.modelCache[Klass._modelName] = Klass;

            console.log('class ' + Klass._modelName + ' e rappresentata da ' + Klass._represent_fields.join(' '));

            for (var ref in _model.references) {
                ref = _model.references[ref];
                //var ext_ref = '_' + ref.id;
                var local_ref = ref.id;
                console.log('inking getter for ' + ref.id + ' to ' + model.name);

                ref.klass = Klass;

                UNLINKED_MODELS.push(ref);
                Klass.prototype.toString = function(x){
                    vals = [];
                    for (f in Klass._represent_fields){
                        vals.push(this[Klass._represent_fields[f]]);
                    }
                    return vals.join(' ');
                }
            }
            // looking for unlinked models
            for (m in UNLINKED_MODELS){
                ref = UNLINKED_MODELS[m];
                console.log('retry to link from ' + ref.klass._modelName + ' to ' + ref.to);
                if (ref.to in W2PRESOURCE.modelCache){
                    linkModel(ref);
                    // unmark model to be linked
                    idx = $.inArray(UNLINKED_MODELS,ref);
                    if (idx != -1)
                        UNLINKED_MODELS.splice(idx,1);
                }
            }
            return Klass;
        };
        var getValues = function(dict){
            var result = [];
            for (var key in dict){
                result.push(dict[key]);
            }
            return result;
        };

        W2PRESOURCE.modelCache = {}; // models descriptions
        W2PRESOURCE.httpCache = {};

        Window.IDB = IDB;
        Window.modelCache = W2PRESOURCE.modelCache;


        this.descriptionCache = {};
        this.decodeFields = function(fields){
            var f;
            for (f in fields) {
                field = fields[f];
                if (field.cardinality){
                    cardinality = field.cardinality;
                    console.log(field);
                    tableName = (cardinality=='single')?f.slice(1):f;
                    W2PRESOURCE.descriptionCache[tableName] = field;
                    nested = {type : (cardinality=='single')?'reference ' + tableName:'referencedBy ' + tableName};
                    nested.fields = W2PRESOURCE.decodeFields(field.fields);
                    nested.id = (cardinality=='single')?f:tableName + '_set';
                    try {
                        W2PRESOURCE.descriptionCache[tableName]['cardinality'];
                    } catch (e) {}
                    console.log(f);
                    fields[f] = nested;
                }
                if (field.type.slice(0, 9) == 'reference') {
                    field.reference = field.type.slice(10);
                    field.type = 'reference';
                    // decoding python format %(<field_name>)s expression
                    ref_table_fields = field.validators.reference;
                    regex = /\%\((\S+)\)\w/
                    if (regex.test(ref_table_fields)) {
                        referenced_fields = [];
                        i = 0;
                        while (regex.test(ref_table_fields.slice(i))) {
                            found = regex.exec(ref_table_fields.slice(i))[1];
                            referenced_fields.push(found);
                            i += found.length + 4;
                        }
                        field.ref_fields = referenced_fields;
                    } else {
                        field.ref_fields = [ref_table_fields];
                    }
                    //field.represent = function (field, item) {
                    //    ret = [];
                    //    for (ff in field.ref_fields) {
                    //        ret.push(item[field.ref_fields[ff]]);
                    //    }
                    //    return ret.join(' ');
                    //}
                }
            }
            return fields;
        };
        this.describe = function(resourceName, callBack){    // direct callback
            ret = W2PRESOURCE.modelCache[resourceName];
            if (ret){
                callBack.apply(this,ret);
            } else {
                W2P_POST(resourceName, 'describe', {}, function (data) {
                    for (var modelName in data){
                        var model = data[modelName];
                        modelClass = makeModelClass(model);
                    }
                    W2PRESOURCE.describe(resourceName,callBack);
                }, null, {cache : W2PRESOURCE.httpCache});
            }
        };
        this.list = function(resourceName,options,scope){  //
            W2P_POST(resourceName,'list',options,W2PRESOURCE.gotData,scope);
        };
        this.put = function(resourceName,item,callBack,scope){
            return W2P_POST(resourceName,'put',item,W2PRESOURCE.gotData,scope);
        };
        this.get = function(resourceName,id,scope){
            return W2P_POST(resourceName,'get/' + id,{},W2PRESOURCE.gotData,scope);
        };
        this.del = function(resourceName, id,scope){
            W2P_POST(resourceName,'delete/' + id,{},function(data){
                $rootScope.$broadcast('item-deleted-' + resourceName, id);
                $rootScope.$broadcast('reference-deleted-' + resourceName, id);
            },scope);
        };
                this.custom = W2P_POST;
        this.refresh = function(tab){
            if (tab){
                $rootScope.$broadcast('items-' + tab, getValues(IDB[tab]));
            } else {
                for (tab in IDB){
                    W2PRESOURCE.refresh(tab)
                }
            }
        };
        this.gotData = function(data){
            for (var modelName in data) {
                W2PRESOURCE.describe(modelName, function (fields, representation, field_aggregations) {
                    var results = data[modelName].results;
                    var modelClass = W2PRESOURCE.modelCache[modelName];

                    // indexing references by its ID
                    rets = [];
                    for (var i in results) {
                        rets.push(new modelClass(results[i]));
                    }
                    results = rets;
                    idx = makeIndex(rets);
                    if (!(modelName in IDB))
                        IDB[modelName] = {};
                    copyAttrs(idx, IDB[modelName]);
                    // putting link to referent model
                    for (var field in modelClass._references) {
                        field_name = '_' + modelClass._references[field];
                        external_name = modelClass._modelName + field_name + '_set';
                        for (var r in rets) {
                            r = rets[r];
                            if (r[field_name])
                                setIDUpdate(r[field_name][external_name], r);
                        }
                    }

                    if (UNLINKED[modelName]) {
                        console.log(UNLINKED[modelName]);
                    }

                    // ask referenced to refresh
                    for (var rr in modelClass._referents) {
                        fid = modelClass._referents[rr][1];
                        rr = modelClass._referents[rr][0];
                        referentModel = W2PRESOURCE.modelCache[rr];
                        referentFieldName = rr + '_' + fid + '_set';
                        // order to refresh
                        for (o in IDB[rr]) {
                            g = IDB[rr][o];
                            //console.log(g['_' + fid]);
                            try {
                                g['_' + fid][referentFieldName].push(g);
                            } catch (e) {
                                console.log('reference for ' + g.toString() + ' to ' + fid + ' is ' + g['_' + fid] + '.');
                            }
                        }
                    }
                    $rootScope.$broadcast('items-' + modelName, rets, data.totalResults, options);
                });
            }
        }
    });

    app.directive('w2pResourceForm', function(w2pResources) {
        var controller = function(w2pResources,$scope, $compile, $http,$templateCache, $controller, $parse) {
            $scope.http = $http;
            $scope.templateCache = $templateCache;
            $scope.controller = $controller;
            $scope.compile = $compile;
            $scope.waiting = true;
            $scope.parse = $parse;
            $scope.w2presources = w2pResources;
        };
        return {
            controller : controller,
            scope : true,
            restrict: 'E',
            link: function (scope, element, attrs) {
                // initialization
                scope.resourceName = attrs.resource;
                scope.edit = ('edit' in attrs) || ('new' in attrs);
                scope.tpl = attrs.template?attrs.template:'/' + scope.$root.options.application + '/static/plugin_angular/templates/model-table.html';
                scope.onSubmit = attrs.onSubmit?scope.parse(attrs.onSubmit):undefined;
                scope.hiddenFields = {};

                // attaching events
                scope.$on('select-' + scope.resourceName,function(evt,item){
                    scope.obj = {};
                    for (f in item){
                        if (f[0] != '_') {
                            scope.obj[f] = item[f];
                        }
                    }
                });

                scope['$set' + scope.resourceName[0].toUpperCase() + scope.resourceName.substring(1)] = function(item){
                    scope.$root.$broadcast('select-' + scope.resourceName,item);
                };
                scope['$edit' + scope.resourceName[0].toUpperCase() + scope.resourceName.substring(1)] = function(val){
                    if (val!=undefined  )
                        scope.edit = val;
                    return scope.edit;
                };

                // enhanced initialization
                if (attrs.hiddenFields){
                        hf = attrs.hiddenFields.split(',');
                    for (f in hf) scope.hiddenFields[hf[f]] = true;
                } else {scope.hiddenFields = {id : true};}
                try {
                    scope.showOk = attrs.showOk ? scope.parse(attrs.showOk)(scope) : true;
                } catch (e){scope.showOk = true}
                scope.fixedFields = attrs.fixedFields?scope.parse(attrs.fixedFields)(scope):{};
                scope.gotModel = function(data,doc){
                    // INITIALIZATION
                    scope.obj = {};
                    scope.model = data;
                    // referencing all fields id
                    for (f in data){
                        scope.model[f].id = f;
                    }
                    // generating sowing field list
                    scope.showFields = [];
                    if ('showFields' in attrs) {
                        sf = attrs.showFields.split(',');
                        for (f in sf) {
                            field = sf[f];
                            if (field in scope.model) {
                                scope.showFields.push(scope.model[field]);
                            }
                        }
                    }
                    else {
                        for (field in scope.model){
                            (!scope.hiddenFields[field]) && scope.showFields.push(scope.model[field]);
                        }
                    }
                    // better defining fields
                    for (f in scope.model){
                        field = scope.model[f];
                        //if (field.type.slice(0,9) == 'reference'){
                        //    field.reference = field.type.slice(10);
                        //    field.type = 'reference';
                        //    // decoding python format %(<field_name>)s expression
                        //    ref_table_fields = field.validators.reference;
                        //    regex = /\%\((\S+)\)\w/
                        //    if (regex.test(ref_table_fields)){
                        //        referenced_fields = [];
                        //        i = 0;
                        //        while (regex.test(ref_table_fields.slice(i))){
                        //            found = regex.exec(ref_table_fields.slice(i))[1];
                        //            referenced_fields.push(found);
                        //            i += found.length + 4;
                        //        }
                        //        field.ref_fields = referenced_fields;
                        //    } else {
                        //        field.ref_fields = [ref_table_fields];
                        //    }
                        //    field.represent = function(field,item){
                        //        ret = [];
                        //        for (f in field.ref_fields){
                        //            ret.push(item[field.ref_fields[f]]);
                        //        }
                        //        return ret.join(' ');
                        //    }
                        //}
                        field.atype = AJS2W2P_TYPES[field.type];
                        field.template = AJS2W2P_TYPES_TEMPLATE[field.type];
                    }
                    // creating new scope and template
                    scope.http.get( scope.tpl, { cache: scope.templateCache } )
                        .then( function( response ) {
                            templateScope = scope.$new();
                            templateScope.model = scope.model;
                            templateCtrl = scope.controller( controller, { $scope: templateScope } );
                            element.html( response.data );
                            element.children().data('$ngControllerController', templateCtrl);
                            scope.compile( element.contents() )( templateScope );
                            // stop waiting widget
                            scope.waiting = false;
                        });
                };
                scope.w2presources.describe(scope.resourceName,scope.gotModel);
                scope.senddata = function(obj){
                    scope.w2presources.put(scope.resourceName,obj ,function(obj){
                        if (scope.onSubmit)
                            scope.onSubmit(scope);
                    });
                }
            }
        };
    });

    app.directive('w2pData',function(w2p, w2pResources, $rootScope, $parse,$compile){
        return {
            controller : function($scope){
            },
            restrict : 'E',
            //scope : true,
            link : function(scope, element, attrs){
                scope.resourceName = attrs.resource;
                scope.selection = attrs.selection;
                scope.fields = attrs.fields?attrs.fields.split(','):false;
                scope.items = [];
                // attaching to events
                scope.$on('items-' + scope.resourceName,function(evt,results,numResults,options){
                    //if (options == scope.opts)
                        scope.items = results;
                });
                scope.$on('item-updated-' + scope.resourceName,function(evt,data,options){
                    // update element if present
                    r = true;
                    for (i = 0; r && (i < scope.items.length); i++) {
                        if (scope.items[i].id == data.id) {
                            r = false;
                            scope.items[i] = data;
                        }
                    }
                    // else add new one
                    if (r) {
                        scope.items.push(data);
                    }
                    // finally apply filter if present
                    if ('filter' in scope.opts)
                        for (f in scope.opts.filter){
                            scope.items = scope.items.filter(function(x){return x[f] == scope.opts.filter[f]});
                        }
                });
                scope.$on('item-deleted-' + scope.resourceName,function(evt,id){
                    scope.items = scope.items.filter(function(x){return x.id != id});
                });
                // attaching to reference events
                w2pResources.describe(scope.resourceName,function(fields){
                   //for (f in fields){
                   //    if (fields[f].type == 'reference'){
                   //        console.log('reference-updated-' + fields[f].reference + ' to ' + scope.resourceName);
                   //        scope.$on('reference-updated-' + fields[f].reference,function(evt,ref){
                   //            for (i in scope.items){
                   //                item = scope.items[i];
                   //                for (f in fields){
                   //                    field = fields[f];
                   //                    if (item[f] == ref.id){
                   //                        item['_' + f] = ref._representsAs;
                   //                    }
                   //
                   //                }
                   //            }
                   //        });
                   //        scope.$on('reference-deleted-' + fields[f].reference,function(evt,id){
                   //            for (i in scope.items){
                   //                item = scope.items[i];
                   //                for (f in fields){
                   //                    field = fields[f];
                   //                    if (item[f] == id){
                   //                        item['_' + f] = ' - ';
                   //                    }
                   //
                   //                }
                   //            }
                   //        });
                   //    }
                   //}
                });
                scope.load = function(){
                    options = {};
                    if (attrs.fields){
                        options.fields = attrs.fields.split(',');
                    }
                    if ('filter' in attrs){
                        options.filter = $parse(attrs.filter)(scope);
                    }
                    if ('withreferences' in attrs){
                        options.withreferences = true;
                    }
                    scope.opts = options;
                    w2pResources.list(scope.resourceName,scope.opts,scope);
                };
                scope.$parent.$parent['$delete' + scope.resourceName[0].toUpperCase() + scope.resourceName.substring(1)] = function(item){
                    w2pResources.del(scope.resourceName,item.id,scope);
                };
                scope.$parent.$parent['$select' + scope.resourceName[0].toUpperCase() + scope.resourceName.substring(1)] = function(item){
                    $rootScope.$broadcast('select-' + scope.resourceName,item);
                    for (i in scope.items){
                        if (scope.items[i]._selected)
                            scope.items[i]._selected = false;
                    }
                    item._selected = true;
                };
                if ('filter' in attrs) {
                    attrs.$observe('filter', scope.load);
                } else {
                    scope.load();
                }
            }
        }
    });

})();
