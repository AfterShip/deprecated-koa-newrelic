# koa-newrelic
Koa middleware to allow Newrelic monitor Koa applications like Express. Supported features:
 - Name transactions according to router (Only support [`koa-router`](https://github.com/alexmingoia/koa-router))
 - Group and name transactions for static resources according to file extensions
 - Traces for Koa middlewares

## Installation
```
npm install koa-newrelic

```

## API
```javascript
var newrelic = require('newrelic');
var koaNewrelic = require('koa-newrelic')(newrelic, opts);

var app = require('koa')();
var router = require('koa-router')();

router.get('/', function *(next) {...});

app
  .use(koaNewrelic);
  .use(router.routes());
```
To record traces of middlewares, please initialize koa-newrelic before adding any middlewares to `app` or `router`

## Options
 - `middlewareTrace` Boolean for if need traces for each middleware. Defaults to `false`
 - `groupStaticResources` Boolean for if need to group transactions by file extension. Defaults to `false`
 - `staticExtensions` Array of file extensions will be grouped if `groupStaticResources` is true. Defaults to `['svg','png','jpg','gif','css','js','html']`
 - `customTransactionName` Function to customize transaction metrics name by `method` and route `path`. Defaults to `(method, path) => 'Expressjs/' + method + '/' + path`

## Examples
```javascript
var koaNewrelic = require('koa-newrelic')(newrelic, {
  middlewareTrace: true,
  groupStaticResources: true,
  staticExtensions: ['js', 'css'],
  customTransactionName: (method, path) => `Koajs/${path.slice(1)}#${method}`
});

router.get('/index', function* ctrA(next) {...});
router.post('/login', function* ctrB(next) {...});

app.use(koaNewrelic)
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
Copyright (c) 2016 AfterShip

Licensed under the MIT license.
