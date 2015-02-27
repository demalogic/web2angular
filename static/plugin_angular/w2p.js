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

    app.controller('menu', function($scope, $rootScope, $http){
        $rootScope.menu = $scope;
        $scope.menuitems = [];

        $http.get('/' + $rootScope.options.application + '/default/menu')
            .success(function(data,status,evt,xhr){
                $scope.menuitems = data.menu;
                $scope.idxItems = {};
                for (i in $scope.menuitems){
                    item = $scope.menuitems[i];
                    $scope.idxItems[item.id] = item;
                }
                $scope.idxItems[data.active].active = true;
            });

        path = window.location.pathname;
        for (item in $scope.menuitems)
            if ($scope.menuitems[item].url == path)
                $scope.menuitems[item].active = true;

        $scope.select = function(item_id){
            item = $scope.idxItems[item_id];
            for (it in $scope.menuitems)
                $scope.menuitems[it].active = (item == $scope.menuitems[it])
            $rootScope.activePage = item;
            $http.get('/' + $rootScope.options.application + '/default/last_menu/' + item.id)
        };
        $scope.ricerca = function(x){
            $scope.termine = '';
            $rootScope.searcher.advancedSearch.fullText = x;
            $rootScope.searcher.searching.fullText = x;
            $rootScope.searcher.ricerca();
        }

    });

    app.directive('modelform', function(w2p) {
        if (!('modelCache' in w2p)){
            w2p.modelCache = {};
        }
        var controller = function(w2p,$scope, $compile, $http,$templateCache, $controller, $parse) {
            $scope.w2p = w2p;
            $scope.http = $http;
            $scope.templateCache = $templateCache;
            $scope.controller = $controller;
            $scope.compile = $compile;
            $scope.$parent.waiting = true;
            $scope.parse = $parse;
            $scope.senddata = function(obj){
                form = $scope[$scope.model_name];
                if (form.$dirty && form.$valid) {
                    for (f in $scope.fixedFields){
                        obj[f] = $scope.fixedFields[f];
                    }
                    w2p.post($scope.w2pfunc, obj)
                        .success(function (a, b, c, d) {
                            if ($scope.$parent[$scope.cb]) {
                                if (($scope.model_name + '_items') in $scope.$parent) {
                                    items = $scope.$parent[$scope.model_name + '_items'].filter(function(x){return x.id != a.id});
                                    items.push(a)
                                    $scope.$parent[$scope.model_name + '_items'] = items;
                                }
                                $scope.$parent[$scope.cb].apply(this, [a, b, c, d]);
                            }
                            $scope.obj = {};
                        })
                }
            };
        };
        return {
            controller : controller,
            scope : true,
            restrict: 'E',
            link: function (scope, element, attrs) {
                scope.model_name = attrs.model;
                scope.edit = ('edit' in attrs) || ('new' in attrs);
                scope.tpl = attrs.template?attrs.template:'/' + scope.$root.options.application + '/static/plugin_angular/templates/model-table.html';
                scope.w2pfunc = attrs.function?attrs.function:'plugin_angular/restful/' + scope.model_name + '/put';
                scope.cb = attrs.onSubmit;
                scope.hiddenFields = {};
                if (attrs.hiddenFields){
                    hf = attrs.hiddenFields.split(',');
                    for (f in hf) scope.hiddenFields[hf[f]] = true;
                } else {scope.hiddenFields = {id : true};}
                try {
                    scope.showOk = attrs.showOk ? scope.parse(attrs.showOk)(scope.$parent) : true;
                } catch (e){scope.showOk = true}
                scope.fixedFields = attrs.fixedFields?scope.parse(attrs.fixedFields)(scope.$parent):{};
                scope.gotModel = function(data){
                    scope.w2p.modelCache[scope.model_name] = data;
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
                        if (field.type.slice(9) == 'reference'){
                            field.atype = 'reference'
                        }
                        field.atype = AJS2W2P_TYPES[field.type];
                        field.template = AJS2W2P_TYPES_TEMPLATE[field.type];

                        // generating all field widgets
                        //for (f in scope.model) {
                        //    scope.model[f].widget = scope.buildWidget(scope.model[f]);
                        //}
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
                        });
                    // put model reference to scope with its name
                    if (!(scope.model_name in scope.$parent)){
                        scope.$parent[scope.model_name] = scope.obj;
                    }
                    // stop waiting widget
                    scope.$parent.waiting = false;
                };
                if (scope.model_name in scope.w2p.modelCache){
                    scope.gotModel(scope.w2p.modelCache[scope.model_name]);
                } else {
                    w2p.get('plugin_angular/model/' + scope.model_name).success(scope.gotModel);
                }
                element.html('-- form model (<b>' + attrs.model + ')</b> --')
            }
        };
    });

    app.directive('w2pdata',function(w2p){
        return {
            scope : true,
            link : function(scope, element, attrs){
                scope.resource = attrs.resource;
                scope.selection = attrs.selection;
                scope.fields = attrs.fields?attrs.fields.split(','):false;
                scope.fetch = function(){
                    kwargs = {};
                    if (scope.fields)
                        kwargs.fields = scope.fields;
                    if (scope.selection)
                        kwargs.selection = scope.selection;
                    w2p.post('plugin_angular/restful/' + scope.resource + '/list',kwargs)
                        .success(function(data){
                            scope.items = data.items;
                            try {
                                row = scope.items[0];
                                scope.fields = [];
                                for (field in row){
                                    scope.fields.push(field);
                                }
                            } catch (e){
                                scope.fields = [];
                            }
                            scope.$parent[scope.resource + '_items'] = data.items;
                        });

                };
                scope.fetch();
                scope.$delete = function(item){
                    w2p.post('plugin_angular/restful/' + scope.resource + '/delete',{id : item.id})
                        .success(function(data,a,b,c){
                            scope.items = scope.items.filter(function(x){return x.id != item.id;});
                            scope.$parent[scope.resource + '_items'] = scope.items;
                        });
                }
            }
        }
    });

})();
