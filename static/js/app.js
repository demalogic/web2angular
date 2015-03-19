/**
 * Created by nihil on 25/02/15.
 */
w2pApp = 'ang2py';

(function(){
    var app = angular.module('app',['web2angular']);

   	app.config(function($interpolateProvider) {
		$interpolateProvider.startSymbol('{*');
		$interpolateProvider.endSymbol('*}');
	});

    app.controller('main',function($scope){
        $scope.inviata = function(){
            alert('inviata');
        };
    });

    app.controller('demoCtrl',function($scope){
    });

    var index = function(list,field){
        result = {};
        for (x in list){
            result[list[x][field]] = list[x];
        }
        return result;
    };

    app.service('TS2',function($rootScope){
        var Service = this;
        var reverseMulti = function (entity,relation){
            var _relation = relation;
            Object.defineProperty(entity,relation + '_set', {
                get : function(){
                    result = [];
                    local_rel = '_' + _relation;
                    for (id in this[local_rel]){
                        result.push(Service[_relation][this[local_rel][id]]);
                    }
                    return result;
                }
            });
        };

        Service.persone = {
            1 : {
                x : 'Homer',
                cognome : 'Simpson',
                eta : 36
            },
            2 : {
                x : 'Marge',
                cognome : 'Bouvier',
                eta : 35
            },
            3 : {
                x : 'Bart',
                cognome : 'Simpson',
                eta : 10
            }
        };
        Service.cani = {
            3 : {
                x : 'Piccolo aiutante di Babbo natale',
                padrone : 3
            },
            7 : {
                x : 'Gatto con gli stivali',
                padrone : 2
            }
        };
        Service.genitori = {
            1 : {
                figlio : 3,
                tipo : 'padre',
                genitore : 1
            },
            2 : {
                figlio : 3,
                tipo : 'madre',
                genitore : 2
            }
        };

        persone = Service.persone;
        for (persona in persone){
            persona = persone[persona];
            if (!('cani' in persona)){
                persona.cani = [];
            }
        }

        Service.relink = function() {
            for (persona in persone) {
                persona = persone[persona];
                //if (!('cani' in persona)) {
                    persona.cani = [];
                    persona._cani = [];
                //}
            }
            persone = Service.persone;
            for (id in Service.cani){
                cane = Service.cani[id];
                persona = Service.persone[cane.padrone];
                if (persona){
                    persona._cani.push(id);
                    cane.padrone = persona;
                    reverseMulti(persona,'cani');
                }
            }
        };

        Service.getCani = function(){
            result = [];
            for (id in this.cani){
                result.push(Service.cani[this.cani[id]]);
            }
            return result;
        };
    });

    app.controller('test2', function($scope,TS2){
        $scope.items = TS2.cani;
        $scope.padroni = TS2.persone;
    });

    app.controller('test21', function($scope,TS2){
        $scope.items = TS2.persone;
        $scope.padroni = TS2.persone;
        $scope.getCani = TS2.getCani;
    });

    app.directive('dynamo',function(TS2){
        return {
            restrict : 'E',
            scope : true,
            link : function(scope,element, attrs){
                scope.items = TS2[attrs.resource];
                scope.padroni = TS2.persone;
            }
        }
    });

    app.controller('test22',function($scope,w2pResources){
        $scope.vuoiAA = false;
        $scope.vuoiBB = false;
        $scope.vuoiCC = false;
        $scope.aa = function(){
            $scope.vuoiAA = !$scope.vuoiAA;
        };
        $scope.y = function(){
            $scope.vuoiAA = false;
        };
        $scope.z = function(){
            w2pResources.IDB.bb[2] = new w2pResources.modelCache.bb({x : 'Lippa',id:2,aa:9});
            w2pResources.refresh();
        };
        $scope.bb = function(){
            $scope.vuoiBB = !$scope.vuoiBB;
        };
        $scope.cc = function(){
            $scope.vuoiCC = !$scope.vuoiCC;
        };
        $scope.call = function(func){
            $scope[func]();
        }
    });
})();