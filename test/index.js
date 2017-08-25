'use strict';

/* eslint-disable no-empty-function */

// need following to trick newrelic to work without config
process.env.NEW_RELIC_NO_CONFIG_FILE = true;
const NewrelicApi = require('newrelic/stub_api');
const newrelic = new NewrelicApi();

const KoaNewrelic = require('../index');
const koa = require('koa');
const Router = require('koa-router');
const request = require('supertest');
const sinon = require('sinon');

const {expect} = require('chai');


let app;
let router;
let koaNewrelic;

describe('koa-newrelic route mapping', function () {
	beforeEach(() => {
		app = new koa();
		router = new Router();
		koaNewrelic = KoaNewrelic(newrelic);

		if (typeof newrelic.setTransactionName === 'function') {
			sinon.spy(newrelic, 'setTransactionName');
		}
	});

	afterEach(() => {
		if (typeof newrelic.setTransactionName === 'function') {
			newrelic.setTransactionName.restore();
		}
	});

	it('should set newrelic transaction name by route if route matched', function (done) {
		const route = '/test/:id';

		app.use(koaNewrelic);
		router.all(route, function () {});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123')
			.end(() => {
				expect(newrelic.setTransactionName.calledWith('Koajs' + route + '#GET')).to.be.true;
				done();
			});
	});

	it('should let newrelic transaction name untouched if no matched route', function (done) {
		app.use(koaNewrelic);
		router.use(function () {});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123')
			.end(() => {
				expect(newrelic.setTransactionName.called).to.be.false;
				done();
			});
	});
});

describe('koa-newrelic group static resouces', function () {
	beforeEach(() => {
		app = new koa();
		router = new Router();
		koaNewrelic = KoaNewrelic(newrelic, {
			groupStaticResources: true
		});

		if (typeof newrelic.setTransactionName === 'function') {
			sinon.spy(newrelic, 'setTransactionName');
		}
	});

	afterEach(() => {
		if (typeof newrelic.setTransactionName === 'function') {
			newrelic.setTransactionName.restore();
		}
	});

	it('should set newrelic transaction name to *.ext if get path end with .ext', function (done) {
		app.use(koaNewrelic);

		request(app.listen())
			.get('/test/123.js')
			.end(() => {
				expect(newrelic.setTransactionName.calledWith('Koajs/*.js#GET')).to.be.true;
				done();
			});
	});

	it('should let newrelic transaction name untouched if access path other than get', function (done) {
		app.use(koaNewrelic);

		request(app.listen())
			.post('/test/123.js')
			.end(() => {
				expect(newrelic.setTransactionName.called).to.be.false;
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
			.end(() => {
				expect(newrelic.setTransactionName.called).to.be.false;
				oneDone();
			});

		request(app.listen())
			.get('/test/12.3js')
			.end(() => {
				expect(newrelic.setTransactionName.called).to.be.false;
				oneDone();
			});
	});

	it('should set newrelic transaction name route if route matched instead of *.ext', function (done) {
		app.use(koaNewrelic);

		router.all('/test/:file', function () {});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123.js')
			.end(() => {
				expect(newrelic.setTransactionName.calledWith('Koajs/test/:file#GET')).to.be.true;
				done();
			});
	});
});

describe('koa-newrelic custom static resouces extensions', function () {
	beforeEach(() => {
		app = new koa();
		router = new Router();
		koaNewrelic = KoaNewrelic(newrelic, {
			groupStaticResources: true,
			staticExtensions: ['weird']
		});

		if (typeof newrelic.setTransactionName === 'function') {
			sinon.spy(newrelic, 'setTransactionName');
		}
	});

	afterEach(() => {
		if (typeof newrelic.setTransactionName === 'function') {
			newrelic.setTransactionName.restore();
		}
	});

	it('should set newrelic transaction name to *.ext if get path end with .ext which matches custom extensions', function (done) {
		app.use(koaNewrelic);

		request(app.listen())
			.get('/test/123.weird')
			.end(() => {
				expect(newrelic.setTransactionName.calledWith('Koajs/*.weird#GET')).to.be.true;
				done();
			});
	});

	it('should let newrelic transaction name untouched if get path end with .ext which doesn`t match custom extensions', function (done) {
		app.use(koaNewrelic);

		request(app.listen())
			.get('/test/123.js')
			.end(() => {
				expect(newrelic.setTransactionName.called).to.be.false;
				done();
			});
	});
});

describe('koa-newrelic custom transaction metric name', function () {
	beforeEach(() => {
		app = new koa();
		router = new Router();
		koaNewrelic = KoaNewrelic(newrelic, {
			customTransactionName: (method, path) => 'Expressjs/' + method + '/' + path
		});

		if (typeof newrelic.setTransactionName === 'function') {
			sinon.spy(newrelic, 'setTransactionName');
		}
	});

	afterEach(() => {
		if (typeof newrelic.setTransactionName === 'function') {
			newrelic.setTransactionName.restore();
		}
	});

	it('should set newrelic transaction name in custom way', function (done) {
		app.use(koaNewrelic);
		router.all('/test/:id', function () {});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123')
			.end(() => {
				expect(newrelic.setTransactionName.calledWith('Expressjs/GET//test/:id')).to.be.true;
				done();
			});
	});
});


describe('koa-newrelic middleware traces', function () {
	beforeEach(() => {
		app = new koa();
		router = new Router();
		koaNewrelic = KoaNewrelic(newrelic, {
			middlewareTrace: true
		});

		if (typeof newrelic.setTransactionName === 'function') {
			sinon.spy(newrelic, 'setTransactionName');
		}
		if (typeof newrelic.createTracer === 'function') {
			sinon.spy(newrelic, 'createTracer');
		}
	});

	afterEach(() => {
		if (typeof newrelic.setTransactionName === 'function') {
			newrelic.setTransactionName.restore();
		}
		if (typeof newrelic.createTracer === 'function') {
			newrelic.createTracer.restore();
		}
	});

	it('should add traces for all middlewares in koa app', function (done) {
		app.use(koaNewrelic);

		app.use(async function middlewareA(ctx, next) {
			await next();
		});

		app.use(async function middlewareB(ctx, next) {
			await next();
		});

		app.use(async function middlewareC() { });

		request(app.listen())
			.get('/test/123')
			.end(() => {
				// koanewrelic itself is also a middleware
				expect(newrelic.createTracer.callCount).to.equal(7);

				expect(newrelic.createTracer.getCall(1).calledWith('Middleware middlewareA')).to.be.true;
				expect(newrelic.createTracer.getCall(2).calledWith('Middleware middlewareB')).to.be.true;
				expect(newrelic.createTracer.getCall(3).calledWith('Middleware middlewareC')).to.be.true;
				expect(newrelic.createTracer.getCall(4).calledWith('Middleware middlewareB')).to.be.true;
				expect(newrelic.createTracer.getCall(5).calledWith('Middleware middlewareA')).to.be.true;
				done();
			});
	});

	it('should add traces for all middlewares in koa-router', function (done) {
		app.use(koaNewrelic);

		router.use(async function middlewareA(ctx, next) {
			await next();
		});

		router.get('/test/:id', async function middlewareB(ctx, next) {
			await next();
		}, async function middlewareC() {});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123')
			.end(() => {
				// koanewrelic itself is also a middleware & router dispatch
				expect(newrelic.createTracer.callCount).to.equal(8);

				expect(newrelic.createTracer.getCall(2).calledWith('Middleware middlewareA')).to.be.true;
				expect(newrelic.createTracer.getCall(3).calledWith('Middleware middlewareB')).to.be.true;
				expect(newrelic.createTracer.getCall(4).calledWith('Middleware middlewareC')).to.be.true;
				expect(newrelic.createTracer.getCall(5).calledWith('Middleware middlewareB')).to.be.true;
				expect(newrelic.createTracer.getCall(6).calledWith('Middleware middlewareA')).to.be.true;

				done();
			});
	});

	it('could support instrument ctx.render', (done) => {
		app.use(koaNewrelic);
		app.use(async function views(ctx, next) {
			ctx.render = () => Promise.resolve(true);
			await next();
		});

		router.get('/test/:id', async function controller(ctx) {
			await ctx.render('testing');
		});

		app.use(router.routes());

		request(app.listen())
			.get('/test/123')
			.end(() => {
				// koanewrelic itself is also a middleware & router dispatch
				expect(newrelic.createTracer.callCount).to.equal(7);

				expect(newrelic.createTracer.getCall(0).calledWith('Middleware koaNewrelic')).to.be.true;
				expect(newrelic.createTracer.getCall(1).calledWith('Middleware views')).to.be.true;
				expect(newrelic.createTracer.getCall(2).calledWith('Middleware dispatch')).to.be.true;
				expect(newrelic.createTracer.getCall(3).calledWith('Middleware controller')).to.be.true;
				expect(newrelic.createTracer.getCall(4).calledWith('Render testing')).to.be.true;
				expect(newrelic.createTracer.getCall(5).calledWith('Middleware views')).to.be.true;
				expect(newrelic.createTracer.getCall(6).calledWith('Middleware koaNewrelic')).to.be.true;

				done();
			});
	});
});
