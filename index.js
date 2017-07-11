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

const extRegExp = /\/[^/]+\.(\w+)$/;

let wrappedFunctions = [];

function registerWrapped(obj, name) {
	wrappedFunctions.push({
		obj,
		name
	});
}

function unwrap() {
	while (wrappedFunctions.length) {
		let wrapped = wrappedFunctions.pop();
		let wrappedFunction = wrapped.obj[wrapped.name];
		wrapped.obj[wrapped.name] = wrappedFunction._original;
	}
}

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
	// unwrap wrapped functions if any
	unwrap();

	if (!newrelic || typeof newrelic !== 'object') {
		throw new Error('Invalid newrelic agent');
	}

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

				let wrapped = async function (ctx, next) {
					let endTracer = newrelic.createTracer(name, () => {});

					let wrappedNext = async function () {
						endTracer();
						try {
							await next();
						} catch (e) {
							throw e;
						} finally {
							endTracer = newrelic.createTracer(name, () => {});
						}
					};

					try {
						await middleware(ctx, wrappedNext);
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
			Koa.prototype.use._original = originalUse;
			registerWrapped(Koa.prototype, 'use');

			try {
				const Router = require('koa-router');

				let originalRegister = Router.prototype.register;

				Router.prototype.register = function () {
					let middlewares = Array.isArray(arguments[2]) ? arguments[2] : [arguments[2]];

					let wrappedMiddlewares = middlewares.map(middleware => wrapMiddleware(middleware));

					arguments[2] = wrappedMiddlewares;
					return originalRegister.apply(this, arguments);
				};
				Router.prototype.register._original = originalRegister;
				registerWrapped(Router.prototype, 'register');
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
		// (method, path) => 'Expressjs/' + method + '/' + path;
		parseTransactionName = (method, path) => 'Koajs/' + (path[0] === '/' ? path.slice(1) : path) + '#' + method;
	}

	function setTransactionName(method, path) {
		newrelic.setTransactionName(parseTransactionName(method, path));
	}

	return async function koaNewrelic(ctx, next) {
		if (opts.preSetTransaction) {
			setTransactionName(ctx.method, ctx.path);
		}

		await next();

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
					}
				}
			}
		}
	};
};
