'use strict';

const KoaNewrelic = require('../index');

const koa = require('koa');
const Router = require('koa-router');
const request = require('supertest');

const expect = require('chai').expect;

let mockNewrelic = {
	agent: {
		getTransaction: function () {
			return transanction;
		}
	},
	createTracer: function (name) {
		if (!traces[name]) {
			traces[name] = 0;
		}

		return function () {
			traces[name]++;
		};
	}
};

let app;
let router;
let transanction;
let traces;
let koaNewrelic;

describe('koa-newrelic route mapping', function () {
	beforeEach(function () {
		app = koa();
		router = new Router();
		transanction = {};
		koaNewrelic = KoaNewrelic(mockNewrelic);
	});

	it('should set newrelic transaction name by route if route matched', function (done) {
		let route = '/test/:id';

		app.use(koaNewrelic);
		router.use(route, function* () {
			return;
		});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123')
			.end(function () {
				expect(transanction.partialName).to.equal('Koajs' + route + '#GET');
				done();
			});
	});

	it('should let newrelic transaction name untouched if no matched route', function (done) {
		app.use(koaNewrelic);
		router.use(function* () {
			return;
		});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123')
			.end(function () {
				expect(transanction.partialName).to.be.undefined;
				done();
			});
	});
});

describe('koa-newrelic group static resouces', function () {
	beforeEach(function () {
		app = koa();
		router = new Router();
		transanction = {};
		koaNewrelic = KoaNewrelic(mockNewrelic, {
			groupStaticResources: true
		});
	});

	it('should set newrelic transaction name to *.ext if get path end with .ext', function (done) {
		app.use(koaNewrelic);

		request(app.listen())
			.get('/test/123.js')
			.end(function () {
				expect(transanction.partialName).to.equal('Koajs/*.js#GET');
				done();
			});
	});

	it('should let newrelic transaction name untouched if access path other than get', function (done) {
		app.use(koaNewrelic);

		request(app.listen())
			.post('/test/123.js')
			.end(function () {
				expect(transanction.partialName).to.be.undefined;
				done();
			});
	});

	it('should let newrelic transaction name untouched if get path not end with .ext', function (done) {
		app.use(koaNewrelic);

		let testCases = 2;
		function oneDone() {
			if (!--testCases) {
				done();
			}
		}

		request(app.listen())
			.get('/test/123js')
			.end(function () {
				expect(transanction.partialName).to.be.undefined;
				oneDone();
			});

		request(app.listen())
			.get('/test/12.3js')
			.end(function () {
				expect(transanction.partialName).to.be.undefined;
				oneDone();
			});
	});

	it('should set newrelic transaction name route if route matched instead of *.ext', function (done) {
		app.use(koaNewrelic);

		router.use('/test/:file', function* () {
			return;
		});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123.js')
			.end(function () {
				expect(transanction.partialName).to.equal('Koajs/test/:file#GET');
				done();
			});
	});
});

describe('koa-newrelic custom static resouces extensions', function () {
	beforeEach(function () {
		app = koa();
		router = new Router();
		transanction = {};
		koaNewrelic = KoaNewrelic(mockNewrelic, {
			groupStaticResources: true,
			staticExtensions: ['weird']
		});
	});

	it('should set newrelic transaction name to *.ext if get path end with .ext which matches custom extensions', function (done) {
		app.use(koaNewrelic);

		request(app.listen())
			.get('/test/123.weird')
			.end(function () {
				expect(transanction.partialName).to.equal('Koajs/*.weird#GET');
				done();
			});
	});

	it('should let newrelic transaction name untouched if get path end with .ext which doesn`t match custom extensions', function (done) {
		app.use(koaNewrelic);

		request(app.listen())
			.get('/test/123.js')
			.end(function () {
				expect(transanction.partialName).to.be.undefined;
				done();
			});
	});
});

describe('koa-newrelic custom transaction metric name', function () {
	beforeEach(function () {
		app = koa();
		router = new Router();
		transanction = {};
		koaNewrelic = KoaNewrelic(mockNewrelic, {
			customTransactionName: function (method, path) {
				return 'Expressjs/' + method + '/' + path;
			}
		});
	});

	it('should set newrelic transaction name in custom way', function (done) {
		app.use(koaNewrelic);
		router.use('/test/:id', function* () {
			return;
		});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123')
			.end(function () {
				expect(transanction.partialName).to.equal('Expressjs/GET//test/:id');
				done();
			});
	});
});


describe('koa-newrelic middleware traces', function () {
	beforeEach(function () {
		app = koa();
		router = new Router();
		transanction = {};
		traces = {};
		koaNewrelic = KoaNewrelic(mockNewrelic, {
			middlewareTrace: true
		});
	});

	it('should add traces for all middlewares in koa app', function (done) {
		app.use(koaNewrelic);

		app.use(function* middlewareA(next) {
			yield next;
		});

		app.use(function* middlewareB(next) {
			yield next;
		});

		app.use(function* middlewareC() {
			return;
		});

		request(app.listen())
			.get('/test/123')
			.end(function () {
				expect(traces['Middleware middlewareA']).to.equal(2);
				expect(traces['Middleware middlewareB']).to.equal(2);
				expect(traces['Middleware middlewareC']).to.equal(1);
				done();
			});
	});

	it('should add traces for all middlewares in koa-router', function (done) {
		app.use(koaNewrelic);

		router.use(function* middlewareA(next) {
			yield next;
		});

		router.get('/test/:id', function* middlewareB(next) {
			yield next;
		}, function* middlewareC() {
			return;
		});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123')
			.end(function () {
				expect(traces['Middleware middlewareA']).to.equal(2);
				expect(traces['Middleware middlewareB']).to.equal(2);
				expect(traces['Middleware middlewareC']).to.equal(1);
				done();
			});
	});
});
