'use strict';

const DEFAULT_STATIC_EXTENSIONS = [
	'svg',
	'png',
	'jpg',
	'gif',
	'css',
	'js',
	'html'
];

const extRegExp = /\/[^\/]+\.(\w+)$/;

/**
 * Create a newrelic middleware.
 * Need to be called before any koa.use & router.register
 *
 * @example
 *
 * Basic usage:
 *
 * var newrelic = require('newrelic');
 * var app = require('koa')();
 * var router = require('koa-router')();
 * var koaNewrelic = require('koa-newrelic')(newrelic, {});
 *
 * router.get('/', function *(next) {...});
 *
 * app
 *   .use(router.routes());
 *
 * @param {Object} newrelic
 * @param {Object} opts
 * @return {Function}
 */
module.exports = function (newrelic, opts) {
	opts = opts || {};

	// middleware traces
	if (opts.middlewareTrace) {
		let anonymousMW = [];

		let wrapMiddleware = function (middleware) {
			if (middleware) {
				// name anonymous middleware
				if (!middleware.name && anonymousMW.indexOf(middleware) === -1) {
					anonymousMW.push(middleware);
				}
				let name = 'Middleware ' + (middleware.name || 'anonymous' + anonymousMW.indexOf(middleware));

				let wrapped = function* (next) {
					let endTracer = newrelic.createTracer(name, () => {});

					let wrappedNext = function* () {
						endTracer();
						try {
							yield next;
						} catch (e) {
							throw e;
						} finally {
							endTracer = newrelic.createTracer(name, () => {});
						}
					};

					try {
						yield middleware.call(this, wrappedNext());
					} catch (e) {
						throw e;
					} finally {
						endTracer();
					}
				};

				return wrapped;
			}

			return middleware;
		};

		try {
			let Koa = require('koa');
			let originalUse = Koa.prototype.use;
			Koa.prototype.use = function (middleware) {
				let wrapped = wrapMiddleware(middleware);
				return originalUse.call(this, wrapped);
			};

			try {
				const Router = require('koa-router');

				let originalRegister = Router.prototype.register;

				Router.prototype.register = function () {
					let middlewares = Array.isArray(arguments[2]) ? arguments[2] : [arguments[2]];

					let wrappedMiddlewares = middlewares.map(middleware => wrapMiddleware(middleware));

					arguments[2] = wrappedMiddlewares;
					return originalRegister.apply(this, arguments);
				};
			} catch (e) {
				// app didn't use koa-router
			}
		} catch (e) {
			// app didn't use koa
			throw new Error('koa-newrelic cannot work without koa');
		}
	}

	// tansaction name
	let parseTransactionName;
	if (opts.customTransactionName && typeof opts.customTransactionName === 'function') {
		parseTransactionName = opts.customTransactionName;
	} else {
		// newrelic has frontend display logic, which will format the transaction name if it's under express
		parseTransactionName = (method, path) => 'Expressjs/' + method + '/' + path;
	}

	function setTransactionName(method, path) {
		newrelic.agent.getTransaction().partialName = parseTransactionName(method, path);
	}

	return function* koaNewrelic(next) {
		let ctx = this;

		yield next;

		if (ctx._matchedRoute) {
			// not macthed to any routes
			if (ctx._matchedRoute === '(.*)') {
				return;
			}
			setTransactionName(ctx.method, ctx._matchedRoute);
			return;
		}

		// group static resources
		if (opts.groupStaticResources) {
			if (ctx.method === 'GET') {
				let extMatch = extRegExp.exec(ctx.path);
				if (extMatch) {
					let ext = extMatch[1];
					let extensions = Array.isArray(opts.staticExtensions) ? opts.staticExtensions : DEFAULT_STATIC_EXTENSIONS;
					if (extensions.indexOf(ext) !== -1) {
						setTransactionName(ctx.method, '/*.' + ext);
						return;
					}
				}
			}
		}
	};
};
