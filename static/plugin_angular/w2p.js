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
    reference:  ''
};

var AJS2W2P_TYPES_TEMPLATE = {
    text:   	'text',
    upload:     'upload',
    reference:  'reference'
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
        var W2P_POST = function (resource,method,data,success){
            $http.post('/' + $rootScope.options.application + '/plugin_angular/restful/' + resource + '/' + method,data,{cache : true})
                .success(function(data) {
                    success.apply(this, [data]);
                })
                .error(function(data){
                    MANAGEERROR(data);
                });
        };
        var W2PRESOURCE = this;
        this.descriptionCache = {};
        this.describe = function(resourceName, callBack){    // direct callback
            ret = W2PRESOURCE.descriptionCache[resourceName];
            if (ret){
                callBack.apply(this,ret);
            } else {
                W2P_POST(resourceName, 'describe', {}, function (data) {
                    doc = data.doc;
                    represents_as = data.representation;
                    data = data.fields;
                    for (f in data) {
                        field = data[f];
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
                    W2PRESOURCE.descriptionCache[resourceName] = [data,represents_as,doc];
                    W2PRESOURCE.describe(resourceName,callBack);
                });
            }
        };
        this.list = function(resourceName,options){  //
            W2P_POST(resourceName,'list',options,function(data){
                // if a list contains other table references it will be spared.
                W2PRESOURCE.describe(resourceName,function(fields, representation){
                    results = data.results;
                    references = data.references;
                    // indexing references by its ID
                    data.references = {};
                    for (tabName in references) {
                        tab = references[tabName];
                        data.references[tabName] = {};
                        for (r in tab){
                            row = tab[r];
                            data.references[tabName][row.id] = row;
                        }
                    }
                    // considering all reference from this model and try to create representing string
                    // and translate all external fields to its representing string
                    for (f in fields){
                        field = fields[f];
                        if (field.type == 'reference'){
                            for (r in results){
                                row = results[r];
                                row['_' + f] = references[field.reference][row[f]];
                            }
                        }
                    }
                    //for (r in results){
                    //    repr = [];
                    //    for (f in representation){
                    //        repr.push(results[r][representation[f]]);
                    //    }
                    //    results[r]._representsAs = repr.join(' ');
                    //}
                    $rootScope.$broadcast('items-' + resourceName, data.results,data.totalResults,options);
                });
            });
        };
        this.put = function(resourceName,item, callBack){
            W2P_POST(resourceName,'put',item,function(data){
                //W2PRESOURCE.describe(resourceName,function(fields, representation) {
                //    for (f in fields){
                //        if (fields[f].type == 'reference'){
                //            data._representsAs = fields[f].represent(fields[f])
                //        }
                //    }
                    $rootScope.$broadcast('item-updated-' + resourceName, data);
                    $rootScope.$broadcast('reference-updated-' + resourceName,{id : data.id, _representsAs : data._representsAs});
                    callBack.apply(this, [data]);
                //});
            });
        };
        this.get = function(resourceName,id){
            W2P_POST(resourceName,'get/' + id,{},function(data){
               $rootScope.$broadcast('item-updated-' + resourceName, data);
            });
        };
        this.del = function(resourceName, id){
            W2P_POST(resourceName,'delete/' + id,{},function(data){
               $rootScope.$broadcast('item-deleted-' + resourceName, id);
            });
        };
    });

    app.directive('w2pResourceForm', function(w2pResources) {
        var controller = function(w2pResources,$scope, $compile, $http,$templateCache, $controller, $parse) {
            $scope.http = $http;
            $scope.templateCache = $templateCache;
            $scope.controller = $controller;
            $scope.compile = $compile;
            $scope.$parent.waiting = true;
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

                scope.$parent['$set' + scope.resourceName[0].toUpperCase() + scope.resourceName.substring(1)] = function(item){
                    scope.$root.$broadcast('select-' + scope.resourceName,item);
                };
                scope.$parent['$edit' + scope.resourceName[0].toUpperCase() + scope.resourceName.substring(1)] = function(val){
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
                    scope.showOk = attrs.showOk ? scope.parse(attrs.showOk)(scope.$parent) : true;
                } catch (e){scope.showOk = true}
                scope.fixedFields = attrs.fixedFields?scope.parse(attrs.fixedFields)(scope.$parent):{};
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
                            scope.$parent.waiting = false;
                        });
                };
                scope.w2presources.describe(scope.resourceName,scope.gotModel);
                scope.senddata = function(obj){
                    scope.w2presources.put(scope.resourceName,obj ,function(obj){
                        if (scope.onSubmit)
                            scope.onSubmit(scope.$parent);
                    });
                }
            }
        };
    });

    app.directive('w2pData',function(w2p, w2pResources, $rootScope, $parse,$filter){
        return {
            scope : true,
            link : function(scope, element, attrs){
                scope.resourceName = attrs.resource;
                scope.selection = attrs.selection;
                scope.fields = attrs.fields?attrs.fields.split(','):false;
                // attaching to events
                scope.$on('items-' + scope.resourceName,function(evt,results,numResults,options){
                    if (options == scope.opts)
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
                    for (f in scope.opts.filter){
                        scope.items = scope.items.filter(function(x){return x[f] == scope.opts.filter[f]});
                    }
                });
                scope.$on('item-deleted-' + scope.resourceName,function(evt,id){
                    scope.items = scope.items.filter(function(x){return x.id != id});
                });
                // attaching to reference events
                w2pResources.describe(scope.resourceName,function(fields){
                   for (f in fields){
                       if (fields[f].type == 'reference'){
                           console.log('reference-updated-' + fields[f].reference + ' to ' + scope.resourceName);
                           scope.$on('reference-updated-' + fields[f].reference,function(evt,ref){
                               for (i in scope.items){
                                   item = scope.items[i];
                                   for (f in fields){
                                       field = fields[f];
                                       if (item[f] == ref.id){
                                           item['_' + f] = ref._representsAs;
                                       }

                                   }
                               }
                           });
                       }
                   }
                });
                options = {};
                if ('fields' in attrs){
                    options.fields = attrs.fields.split(',');
                }
                if ('filter' in attrs){
                    options.filter = $parse(attrs.filter)(scope.$parent);
                }
                scope.opts = options;
                w2pResources.list(scope.resourceName,scope.opts);
                scope.$parent['$delete' + scope.resourceName[0].toUpperCase() + scope.resourceName.substring(1)] = function(item){
                    w2pResources.del(scope.resourceName,item.id);
                };
                scope.$parent['$select' + scope.resourceName[0].toUpperCase() + scope.resourceName.substring(1)] = function(item){
                    $rootScope.$broadcast('select-' + scope.resourceName,item);
                };
            }
        }
    });

})();
