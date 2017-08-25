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

const DEFAULT_CUSTOME_TRANSACTION_NAME = (method, path) => 'Koajs/' + (path[0] === '/' ? path.slice(1) : path) + '#' + method;

const DEFAULT_RENDER_METHOD = 'render';

const EXT_REGEX = /\/[^/]+\.(\w+)$/;

/**
 * Create a newrelic middleware.
 * Need to be called before any koa.use & router.register
 *
 * @example
 *
 * Basic usage:
 *
 * const newrelic = require('newrelic');
 * const Koa = requrie('koa');
 * const Router = require('koa-router');
 * const app = new Koa();
 * const router = new Router();
 * const koaNewrelic = require('koa-newrelic')(newrelic, {});
 *
 * router.get('/', async (ctx) => {...});
 *
 * app
 *   .use(router.routes());
 *
 * @param {Object} newrelic
 * @param {Object} opts
 * @param {Boolean} opts.groupStaticResources - Boolean for if need to group transactions by file extension. Defaults to `false`
 * @param {Boolean} opts.middlewareTrace - Boolean for if need traces for each middleware. Defaults to `false`
 * @param {Function} opts.customTransactionName - Function to customize transaction metrics name by `method` and route `path`.
 *                                                Defaults to `(method, path) => 'Koajs/' + (path[0] === '/' ? path.slice(1) : path) + '#' + method`
 * @param {String} opts.renderMethodName - name of render method for the framework. Default to `render`
 * @param {[String]} opts.staticExtensions - Array of file extensions will be grouped if `groupStaticResources` is true.
 *                                           Defaults to `['svg','png','jpg','gif','css','js','html']`
 *
 * @return {Function}
 */
module.exports = function (newrelic, opts = {}) {
	// unwrap wrapped functions if any
	unwrap();
	const renderMethodName = opts.renderMethodName || DEFAULT_RENDER_METHOD;

	if (!newrelic || typeof newrelic !== 'object') {
		throw new Error('Invalid newrelic agent');
	}

	// middleware traces
	if (opts.middlewareTrace) {
		traceMiddlewares(newrelic);
	}

	// tansaction name
	let parseTransactionName;
	if (opts.customTransactionName && typeof opts.customTransactionName === 'function') {
		parseTransactionName = opts.customTransactionName;
	} else {
		// newrelic has frontend display logic, which will format the transaction name if it's under express
		// (method, path) => 'Expressjs/' + method + '/' + path;
		parseTransactionName = DEFAULT_CUSTOME_TRANSACTION_NAME;
	}

	function setTransactionName(method, path) {
		newrelic.setTransactionName(parseTransactionName(method, path));
	}

	return async function koaNewrelic(ctx, next) {
		// for patching the render method
		Object.defineProperty(ctx, renderMethodName, {
			configurable: true,
			get() {
				return ctx['_' + renderMethodName];
			},
			set(newRender) {
				ctx['_' + renderMethodName] = async function wrappedRender(...args) {
					const endTracer = newrelic.createTracer('Render ' + args[0], () => {});
					const result = await newRender(...args);
					endTracer();
					return result;
				};
			}
		});
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
				const extMatch = EXT_REGEX.exec(ctx.path);
				if (extMatch) {
					const [ext] = extMatch.slice(1);
					const extensions = Array.isArray(opts.staticExtensions) ? opts.staticExtensions : DEFAULT_STATIC_EXTENSIONS;
					if (extensions.indexOf(ext) !== -1) {
						setTransactionName(ctx.method, '/*.' + ext);
					}
				}
			}
		}
	};
};


/**
 * traceMiddlewares
 *
 * Patch
 *   Koa.prototype.use
 *   koa-router.prototype.register
 * to breakdown each middleware/controller usage
 *
 * @param  {Object} newrelic - the newrelic instance
 */
function traceMiddlewares(newrelic) {
	const anonymousMW = [];

	const wrapMiddleware = function (middleware) {
		if (middleware) {
			// name anonymous middleware
			if (!middleware.name && anonymousMW.indexOf(middleware) === -1) {
				anonymousMW.push(middleware);
			}
			const name = 'Middleware ' + (middleware.name || 'anonymous' + anonymousMW.indexOf(middleware));

			const wrapped = async function (ctx, next) {
				let endTracer = newrelic.createTracer(name, () => {});

				const wrappedNext = async function () {
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
		const Koa = require('koa');
		const originalUse = Koa.prototype.use;
		Koa.prototype.use = function (middleware) {
			const wrapped = wrapMiddleware(middleware);
			return originalUse.call(this, wrapped);
		};
		Koa.prototype.use._original = originalUse;
		registerWrapped(Koa.prototype, 'use');
	} catch (e) {
		// app didn't use koa
		throw new Error('koa-newrelic cannot work without koa');
	}

	try {
		const Router = require('koa-router');

		const originalRegister = Router.prototype.register;

		Router.prototype.register = function (...args) {
			const middlewares = Array.isArray(args[2]) ? args[2] : [args[2]];

			const wrappedMiddlewares = middlewares.map(middleware => wrapMiddleware(middleware));

			return originalRegister.apply(this, [args[0], args[1], wrappedMiddlewares, args[3]]);
		};
		Router.prototype.register._original = originalRegister;
		registerWrapped(Router.prototype, 'register');
	} catch (e) {
		// app didn't use koa-router
	}
}

const wrappedFunctions = [];

function registerWrapped(obj, name) {
	wrappedFunctions.push({
		obj,
		name
	});
}

function unwrap() {
	while (wrappedFunctions.length) {
		const wrapped = wrappedFunctions.pop();
		const wrappedFunction = wrapped.obj[wrapped.name];
		wrapped.obj[wrapped.name] = wrappedFunction._original;
	}
}
