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

    app.controller('demoCtrl',function($scope,$modal){
        $scope.ask = function(text){
            return confirm(text);
        };
        $scope.select = function(item){
            for (f in item){
                $scope.person[f] = item[f];
            }
        };
        $scope.personCreated = function(data,a,c,b){
            console.log(data);
        };
        $scope.$delete = function (item){
            alert(item.id);
        }
    });
})();