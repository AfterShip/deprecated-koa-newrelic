# koa-newrelic
Koa middleware to allow Newrelic monitor Koa applications like Express. Supported features:
 - Name transactions according to router (Only support [`koa-router`](https://github.com/alexmingoia/koa-router))
 - Group and name transactions for static resources according to file extensions
 - Traces for Koa middlewares
 - Traces ctx.render

## koa 1.x
See [koa-newrelic 1.x](https://github.com/aftership/koa-newrelic/tree/1.x) for koa 1.x support.

## Installation
```
npm install koa-newrelic
```

## API
```javascript
const newrelic = require('newrelic');
const koaNewrelic = require('koa-newrelic')(newrelic, opts);
const Koa = require('koa');
const Router = require('koa-router');
const views = require('koa-views');

const app = new Koa();
const router = new Router;

router.get('/', async function (next) {...});

app
  .use(koaNewrelic);
  .use(views()) // use views middleware could help instrument ctx.render method
  .use(router.routes());
```
To record traces of middlewares, please initialize koa-newrelic before adding any middlewares to `app` or `router`

## Options
 - `middlewareTrace` Boolean for if need traces for each middleware. Defaults to `false`
 - `groupStaticResources` Boolean for if need to group transactions by file extension. Defaults to `false`
 - `staticExtensions` Array of file extensions will be grouped if `groupStaticResources` is true. Defaults to `['svg','png','jpg','gif','css','js','html']`
 - `customTransactionName` Function to customize transaction metrics name by `method` and route `path`. Defaults to `(method, path) => 'Koajs/' + (path[0] === '/' ? path.slice(1) : path) + '#' + method`
 - `renderMethodName` name of render method for the framework. Default to `render`

## Examples
```javascript
const koaNewrelic = require('koa-newrelic')(newrelic, {
  renderMethodName: 'render',
  middlewareTrace: true,
  groupStaticResources: true,
  staticExtensions: ['js', 'css'],
  customTransactionName: (method, path) => `Koajs/${path.slice(1)}#${method}`
});

router.get('/index', async function ctrA(ctx) {...});
router.post('/login', async function ctrB(ctx) {...});

app
	.use(koaNewrelic)
  .use(serve('/public'));
  .use(router.routes());

/*
  In Newrelic, you will find following transactions

    /index#GET
	  Middleware serve
	  Middleware dispatch
	  Middleware ctrA

	/login#POST
	  Middleware serve
	  Middleware dispatch
	  Middleware ctrB

	/*.js#GET
	  Middleware serve

	/*.css#GET
	  Middleware serve  
*/
```

## Test
```
npm test
```

## Known Issues


## License
Copyright (c) 2017 AfterShip

Licensed under the MIT license.
