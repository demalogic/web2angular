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
})();