(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
;(function () {
  if (!document.getElementById('rhna-data-app')) return

  const Airtable = require('airtable')
  const base = new Airtable({ apiKey: 'keyY6U9sItI9v3HG1' }).base(
    'appRD2z3VXs78iq80'
  )

  // global object holding all records, keyed by airtable id
  const cities = {}

  // allows for parent to set custom display of field as well as
  // automatically handling fallback "missing info" call to action
  Vue.component('field', {
    props: ['title', 'value'],
    template: `<div>
      {{ title }}:
      <slot v-if="value">{{ value }}</slot>
      <a href="https://airtable.com/shr9fipLLj1WTHKu7" target="_blank" v-else>Missing data, volunteer to help!</a>
    </div>`,
  })

  const data = {
    city: null,
    modalVisible: false,
    modalData: null,
    chartRendered: false,
  }
  const app = new Vue({
    el: '#rhna-data-app',
    data: data,
    computed: {
      progressColor: function () {
        if (this.city.progress < 50) {
          return 'red'
        } else if (this.city.progress < 90) {
          return 'orange'
        } else {
          return 'green'
        }
      },
    },
    updated: function () {
      if (!this.city) return

      if (!this.chartRendered) {
        renderRHNAChart(this.city)
        this.chartRendered = true
      }

      if (this.city.calendarIds) {
        Promise.all(
          this.city.calendarIds.map((calendarId) =>
            base('Calendar').find(calendarId)
          )
        ).then((calendars) => {
          this.city.calendars = calendars.map(normalizeCalendarRecord)
          // debugger
          delete this.city.calendarIds
        })
      }

      if (this.city.meetingReportIDs) {
        Promise.all(
          this.city.meetingReportIDs.map((meetingReportID) =>
            base('Reports').find(meetingReportID)
          )
        ).then((reports) => {
          this.city.meetingReports = reports.map(normalizeReportRecord)
          delete this.city.meetingReportIDs
        })
      }
    },
    methods: {
      openModal(data) {
        this.modalData = data
        this.modalVisible = true
      },
      closeModal() {
        this.modalVisible = false
      },
    },
    filters: {
      truncate: function (text) {
        if (!text) return ''
        text = text.toString()
        if (text.length > 200) return text.slice(0, 197) + '...'
        return text
      },
    },
  })

  function renderRHNAChart(city) {
    const charts = document.getElementById('rhna-charts')
    charts.innerHTML = ''
    const canvas = document.createElement('canvas')
    canvas.height = 200
    canvas.width = 400
    charts.appendChild(canvas)

    const ctx = canvas.getContext('2d')

    const chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [
          'Very Low Income',
          'Low Income',
          'Moderate Income',
          'Above Moderate Income',
        ],
        datasets: [
          {
            label: '6th Cycle RHNA',
            backgroundColor: ['#1e697a', '#7a0027', '#db6400', '#f8a62b'],
            data: [city.vli, city.li, city.mi, city.ami],
          },
        ],
      },
      options: {
        legend: { display: true },
        title: {
          display: true,
          fontSize: 16,
          fontColor: '#000',
          text: '6th Cycle RHNA Allocation: By Income',
        },
      },
    })
  }

  function selectionChanged(id) {
    data.city = cities[id]
    data.chartRendered = false
    document.getElementById('rhna-data-app').style.display = 'block'
    window.location.hash = id
  }

  // Populates the select dropdown with all cities from values.
  function populateSelectorWithCities(cities) {
    const selector = document.getElementById('rhna-selector')
    let cities_arr = []
    for (id in cities) {
      if (cities[id].jurisdiction)
        cities_arr.push([cities[id].jurisdiction, id])
    }

    cities_arr.sort()

    for ([jurisdiction, id] of cities_arr) {
      const opt = document.createElement('option')
      opt.innerText = jurisdiction
      opt.value = id
      selector.appendChild(opt)
    }
  }

  function normalizeCityRecord(record) {
    const fields = {
      ami: 'AMI',
      council: 'COG_display',
      countVolunteers: '# Volunteers',
      county: 'County_display',
      density: 'Density',
      dueDate: 'Due Date',
      fifthElementDraftUrl: '5th Cycle Housing Element',
      HEWebpageUrl: 'City HE Webpage',
      HESurveyUrl: 'Housing Survey',
      HEStatus: 'HE Compliance',
      jurisdiction: 'Jurisdiction',
      li: 'LI',
      mi: 'MI',
      medianIncome: 'Median Income',
      population: 'Population (2020)',
      progress: '5th Cycle Progress %',
      rhna5: '5th Cycle RHNA (Total)',
      rhna6: '6th Cycle RHNA',
      sixthElementDraftUrl: '6th Cycle Draft',
      vli: 'VLI',
      meetingReports: 'MtgReport_display',
    }

    for (key in fields) {
      let value = record.fields[fields[key]]
      if (Array.isArray(value) && value.length == 1) {
        value = value[0]
      }
      fields[key] = value
    }

    if (fields.dueDate) {
      const today = new Date()
      const one_day = 1000 * 60 * 60 * 24
      fields.dueDate = new Date(fields.dueDate)
      fields.dueDaysLeft = Math.floor(
        (fields.dueDate.getTime() - today.getTime()) / one_day
      )
    }

    switch (fields.progress) {
      case '':
      case 'NaN':
      case '0':
      case '0%':
      case '0.0%':
      case undefined:
        fields.progress = null
        break
      default:
        fields.progress = Math.round(parseFloat(fields.progress) * 100)
    }

    fields.calendarIds = record.fields.Calendar
    fields.calendars = []

    fields.meetingReportIDs = record.fields['Mtg Reports']
    fields.meetingReports = []

    fields.id = record.id
    return fields
  }

  function normalizeCalendarRecord(record) {
    const fields = {
      date: 'Date & Time',
      description: 'Short Description',
      link: 'Website',
    }

    for (key in fields) {
      let value = record.fields[fields[key]]
      if (Array.isArray(value) && value.length == 1) {
        value = value[0]
      }
      fields[key] = value
    }

    fields.date = new Date(fields.date)

    fields.id = record.id
    return fields
  }

  function normalizeReportRecord(record) {
    const fields = {
      report: 'Report',
    }

    for (key in fields) {
      let value = record.fields[fields[key]]
      if (Array.isArray(value) && value.length == 1) {
        value = value[0]
      }
      fields[key] = value
    }

    fields.id = record.id
    return fields
  }

  function populateCitiesFromAirtable() {
    return new Promise((resolve, reject) => {
      base('Cities')
        .select({ view: 'City Data' })
        .eachPage(
          function page(records, fetchNextPage) {
            records.forEach(
              (record) => (cities[record.id] = normalizeCityRecord(record))
            )
            fetchNextPage()
          },
          function done(err) {
            if (err) {
              console.error(err)
              reject(err)
            } else {
              resolve()
            }
          }
        )
    })
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rhna-selector').addEventListener('change', (e) => {
      selectionChanged(e.target.value)
    })

    if (window.location.hash.length > 1) {
      const hash = decodeURI(document.location.hash.substring(1))
      base('Cities')
        .find(hash)
        .then((record) => {
          cities[record.id] = normalizeCityRecord(record)
          selectionChanged(hash)
          populateCitiesFromAirtable().then(() => {
            populateSelectorWithCities(cities)
            document.getElementById('rhna-selector').value = hash
          })
        })
    } else {
      populateCitiesFromAirtable().then(() => {
        populateSelectorWithCities(cities)
      })
    }
  })
})()

},{"airtable":5}],2:[function(require,module,exports){
document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementsByClassName('list__table')) return

  const Airtable = require('airtable')
  const base = new Airtable({ apiKey: 'keyY6U9sItI9v3HG1' }).base(
    'appRD2z3VXs78iq80'
  )

  function getTopVolunteers() {
    const fields = {
      total: 'Total score',
      calendar: '# Calendar Entries',
      homework: '# Homework Entries',
      meeting: '# Meeting Reports',
    }

    const volunteer_groups = []
    for (const field in fields) {
      volunteer_groups.push(getTopVolunteersByField(fields[field]))
    }
    return Promise.all(volunteer_groups).then((groups) => {
      const keyed_groups = {}
      let i = 0
      for (const field in fields) {
        keyed_groups[field] = groups[i]
        i++
      }
      return keyed_groups
    })
  }

  function getTopVolunteersByField(field) {
    return new Promise((resolve, reject) => {
      base('Volunteers')
        .select({
          view: 'Individual Leaderboard',
          maxRecords: 5,
          sort: [{ field: field, direction: 'desc' }],
        })
        .firstPage(function (err, records) {
          if (err) {
            console.error(err)
            reject(err)
          } else {
            resolve(
              records.map((record) => {
                return {
                  name: record.fields['Full Name'],
                  location: record.fields['Hometown'],
                  score: record.fields[field],
                }
              })
            )
          }
        })
    })
  }

  getTopVolunteers().then((volunteer_groups) => {
    for (const table of document.getElementsByClassName('list__table')) {
      new Vue({
        el: table,
        data: volunteer_groups,
      })
    }
  })
})

},{"airtable":5}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true
    }
  });
  if (superClass) _setPrototypeOf(subClass, superClass);
}

function _getPrototypeOf(o) {
  _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
    return o.__proto__ || Object.getPrototypeOf(o);
  };
  return _getPrototypeOf(o);
}

function _setPrototypeOf(o, p) {
  _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
    o.__proto__ = p;
    return o;
  };

  return _setPrototypeOf(o, p);
}

function _isNativeReflectConstruct() {
  if (typeof Reflect === "undefined" || !Reflect.construct) return false;
  if (Reflect.construct.sham) return false;
  if (typeof Proxy === "function") return true;

  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
    return true;
  } catch (e) {
    return false;
  }
}

function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return self;
}

function _possibleConstructorReturn(self, call) {
  if (call && (typeof call === "object" || typeof call === "function")) {
    return call;
  }

  return _assertThisInitialized(self);
}

function _createSuper(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct();

  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived),
        result;

    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;

      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }

    return _possibleConstructorReturn(this, result);
  };
}

function _superPropBase(object, property) {
  while (!Object.prototype.hasOwnProperty.call(object, property)) {
    object = _getPrototypeOf(object);
    if (object === null) break;
  }

  return object;
}

function _get(target, property, receiver) {
  if (typeof Reflect !== "undefined" && Reflect.get) {
    _get = Reflect.get;
  } else {
    _get = function _get(target, property, receiver) {
      var base = _superPropBase(target, property);

      if (!base) return;
      var desc = Object.getOwnPropertyDescriptor(base, property);

      if (desc.get) {
        return desc.get.call(receiver);
      }

      return desc.value;
    };
  }

  return _get(target, property, receiver || target);
}

var Emitter = /*#__PURE__*/function () {
  function Emitter() {
    _classCallCheck(this, Emitter);

    Object.defineProperty(this, 'listeners', {
      value: {},
      writable: true,
      configurable: true
    });
  }

  _createClass(Emitter, [{
    key: "addEventListener",
    value: function addEventListener(type, callback, options) {
      if (!(type in this.listeners)) {
        this.listeners[type] = [];
      }

      this.listeners[type].push({
        callback: callback,
        options: options
      });
    }
  }, {
    key: "removeEventListener",
    value: function removeEventListener(type, callback) {
      if (!(type in this.listeners)) {
        return;
      }

      var stack = this.listeners[type];

      for (var i = 0, l = stack.length; i < l; i++) {
        if (stack[i].callback === callback) {
          stack.splice(i, 1);
          return;
        }
      }
    }
  }, {
    key: "dispatchEvent",
    value: function dispatchEvent(event) {
      if (!(event.type in this.listeners)) {
        return;
      }

      var stack = this.listeners[event.type];
      var stackToCall = stack.slice();

      for (var i = 0, l = stackToCall.length; i < l; i++) {
        var listener = stackToCall[i];

        try {
          listener.callback.call(this, event);
        } catch (e) {
          Promise.resolve().then(function () {
            throw e;
          });
        }

        if (listener.options && listener.options.once) {
          this.removeEventListener(event.type, listener.callback);
        }
      }

      return !event.defaultPrevented;
    }
  }]);

  return Emitter;
}();

var AbortSignal = /*#__PURE__*/function (_Emitter) {
  _inherits(AbortSignal, _Emitter);

  var _super = _createSuper(AbortSignal);

  function AbortSignal() {
    var _this;

    _classCallCheck(this, AbortSignal);

    _this = _super.call(this); // Some versions of babel does not transpile super() correctly for IE <= 10, if the parent
    // constructor has failed to run, then "this.listeners" will still be undefined and then we call
    // the parent constructor directly instead as a workaround. For general details, see babel bug:
    // https://github.com/babel/babel/issues/3041
    // This hack was added as a fix for the issue described here:
    // https://github.com/Financial-Times/polyfill-library/pull/59#issuecomment-477558042

    if (!_this.listeners) {
      Emitter.call(_assertThisInitialized(_this));
    } // Compared to assignment, Object.defineProperty makes properties non-enumerable by default and
    // we want Object.keys(new AbortController().signal) to be [] for compat with the native impl


    Object.defineProperty(_assertThisInitialized(_this), 'aborted', {
      value: false,
      writable: true,
      configurable: true
    });
    Object.defineProperty(_assertThisInitialized(_this), 'onabort', {
      value: null,
      writable: true,
      configurable: true
    });
    return _this;
  }

  _createClass(AbortSignal, [{
    key: "toString",
    value: function toString() {
      return '[object AbortSignal]';
    }
  }, {
    key: "dispatchEvent",
    value: function dispatchEvent(event) {
      if (event.type === 'abort') {
        this.aborted = true;

        if (typeof this.onabort === 'function') {
          this.onabort.call(this, event);
        }
      }

      _get(_getPrototypeOf(AbortSignal.prototype), "dispatchEvent", this).call(this, event);
    }
  }]);

  return AbortSignal;
}(Emitter);
var AbortController = /*#__PURE__*/function () {
  function AbortController() {
    _classCallCheck(this, AbortController);

    // Compared to assignment, Object.defineProperty makes properties non-enumerable by default and
    // we want Object.keys(new AbortController()) to be [] for compat with the native impl
    Object.defineProperty(this, 'signal', {
      value: new AbortSignal(),
      writable: true,
      configurable: true
    });
  }

  _createClass(AbortController, [{
    key: "abort",
    value: function abort() {
      var event;

      try {
        event = new Event('abort');
      } catch (e) {
        if (typeof document !== 'undefined') {
          if (!document.createEvent) {
            // For Internet Explorer 8:
            event = document.createEventObject();
            event.type = 'abort';
          } else {
            // For Internet Explorer 11:
            event = document.createEvent('Event');
            event.initEvent('abort', false, false);
          }
        } else {
          // Fallback where document isn't available:
          event = {
            type: 'abort',
            bubbles: false,
            cancelable: false
          };
        }
      }

      this.signal.dispatchEvent(event);
    }
  }, {
    key: "toString",
    value: function toString() {
      return '[object AbortController]';
    }
  }]);

  return AbortController;
}();

if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
  // These are necessary to make sure that we get correct output for:
  // Object.prototype.toString.call(new AbortController())
  AbortController.prototype[Symbol.toStringTag] = 'AbortController';
  AbortSignal.prototype[Symbol.toStringTag] = 'AbortSignal';
}

function polyfillNeeded(self) {
  if (self.__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL) {
    console.log('__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL=true is set, will force install polyfill');
    return true;
  } // Note that the "unfetch" minimal fetch polyfill defines fetch() without
  // defining window.Request, and this polyfill need to work on top of unfetch
  // so the below feature detection needs the !self.AbortController part.
  // The Request.prototype check is also needed because Safari versions 11.1.2
  // up to and including 12.1.x has a window.AbortController present but still
  // does NOT correctly implement abortable fetch:
  // https://bugs.webkit.org/show_bug.cgi?id=174980#c2


  return typeof self.Request === 'function' && !self.Request.prototype.hasOwnProperty('signal') || !self.AbortController;
}

/**
 * Note: the "fetch.Request" default value is available for fetch imported from
 * the "node-fetch" package and not in browsers. This is OK since browsers
 * will be importing umd-polyfill.js from that path "self" is passed the
 * decorator so the default value will not be used (because browsers that define
 * fetch also has Request). One quirky setup where self.fetch exists but
 * self.Request does not is when the "unfetch" minimal fetch polyfill is used
 * on top of IE11; for this case the browser will try to use the fetch.Request
 * default value which in turn will be undefined but then then "if (Request)"
 * will ensure that you get a patched fetch but still no Request (as expected).
 * @param {fetch, Request = fetch.Request}
 * @returns {fetch: abortableFetch, Request: AbortableRequest}
 */

function abortableFetchDecorator(patchTargets) {
  if ('function' === typeof patchTargets) {
    patchTargets = {
      fetch: patchTargets
    };
  }

  var _patchTargets = patchTargets,
      fetch = _patchTargets.fetch,
      _patchTargets$Request = _patchTargets.Request,
      NativeRequest = _patchTargets$Request === void 0 ? fetch.Request : _patchTargets$Request,
      NativeAbortController = _patchTargets.AbortController,
      _patchTargets$__FORCE = _patchTargets.__FORCE_INSTALL_ABORTCONTROLLER_POLYFILL,
      __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL = _patchTargets$__FORCE === void 0 ? false : _patchTargets$__FORCE;

  if (!polyfillNeeded({
    fetch: fetch,
    Request: NativeRequest,
    AbortController: NativeAbortController,
    __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL: __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL
  })) {
    return {
      fetch: fetch,
      Request: Request
    };
  }

  var Request = NativeRequest; // Note that the "unfetch" minimal fetch polyfill defines fetch() without
  // defining window.Request, and this polyfill need to work on top of unfetch
  // hence we only patch it if it's available. Also we don't patch it if signal
  // is already available on the Request prototype because in this case support
  // is present and the patching below can cause a crash since it assigns to
  // request.signal which is technically a read-only property. This latter error
  // happens when you run the main5.js node-fetch example in the repo
  // "abortcontroller-polyfill-examples". The exact error is:
  //   request.signal = init.signal;
  //   ^
  // TypeError: Cannot set property signal of #<Request> which has only a getter

  if (Request && !Request.prototype.hasOwnProperty('signal') || __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL) {
    Request = function Request(input, init) {
      var signal;

      if (init && init.signal) {
        signal = init.signal; // Never pass init.signal to the native Request implementation when the polyfill has
        // been installed because if we're running on top of a browser with a
        // working native AbortController (i.e. the polyfill was installed due to
        // __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL being set), then passing our
        // fake AbortSignal to the native fetch will trigger:
        // TypeError: Failed to construct 'Request': member signal is not of type AbortSignal.

        delete init.signal;
      }

      var request = new NativeRequest(input, init);

      if (signal) {
        Object.defineProperty(request, 'signal', {
          writable: false,
          enumerable: false,
          configurable: true,
          value: signal
        });
      }

      return request;
    };

    Request.prototype = NativeRequest.prototype;
  }

  var realFetch = fetch;

  var abortableFetch = function abortableFetch(input, init) {
    var signal = Request && Request.prototype.isPrototypeOf(input) ? input.signal : init ? init.signal : undefined;

    if (signal) {
      var abortError;

      try {
        abortError = new DOMException('Aborted', 'AbortError');
      } catch (err) {
        // IE 11 does not support calling the DOMException constructor, use a
        // regular error object on it instead.
        abortError = new Error('Aborted');
        abortError.name = 'AbortError';
      } // Return early if already aborted, thus avoiding making an HTTP request


      if (signal.aborted) {
        return Promise.reject(abortError);
      } // Turn an event into a promise, reject it once `abort` is dispatched


      var cancellation = new Promise(function (_, reject) {
        signal.addEventListener('abort', function () {
          return reject(abortError);
        }, {
          once: true
        });
      });

      if (init && init.signal) {
        // Never pass .signal to the native implementation when the polyfill has
        // been installed because if we're running on top of a browser with a
        // working native AbortController (i.e. the polyfill was installed due to
        // __FORCE_INSTALL_ABORTCONTROLLER_POLYFILL being set), then passing our
        // fake AbortSignal to the native fetch will trigger:
        // TypeError: Failed to execute 'fetch' on 'Window': member signal is not of type AbortSignal.
        delete init.signal;
      } // Return the fastest promise (don't need to wait for request to finish)


      return Promise.race([cancellation, realFetch(input, init)]);
    }

    return realFetch(input, init);
  };

  return {
    fetch: abortableFetch,
    Request: Request
  };
}

exports.AbortController = AbortController;
exports.AbortSignal = AbortSignal;
exports.abortableFetch = abortableFetchDecorator;

},{}],4:[function(require,module,exports){
"use strict";
// istanbul ignore file
var AbortController;
if (typeof window === 'undefined') {
    AbortController = require('abort-controller');
}
else if ('signal' in new Request('')) {
    AbortController = window.AbortController;
}
else {
    /* eslint-disable @typescript-eslint/no-var-requires */
    var polyfill = require('abortcontroller-polyfill/dist/cjs-ponyfill');
    /* eslint-enable @typescript-eslint/no-var-requires */
    AbortController = polyfill.AbortController;
}
module.exports = AbortController;

},{"abort-controller":23,"abortcontroller-polyfill/dist/cjs-ponyfill":3}],5:[function(require,module,exports){
(function (process){(function (){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var base_1 = __importDefault(require("./base"));
var record_1 = __importDefault(require("./record"));
var table_1 = __importDefault(require("./table"));
var airtable_error_1 = __importDefault(require("./airtable_error"));
var Airtable = /** @class */ (function () {
    function Airtable(opts) {
        if (opts === void 0) { opts = {}; }
        var defaultConfig = Airtable.default_config();
        var apiVersion = opts.apiVersion || Airtable.apiVersion || defaultConfig.apiVersion;
        Object.defineProperties(this, {
            _apiKey: {
                value: opts.apiKey || Airtable.apiKey || defaultConfig.apiKey,
            },
            _apiVersion: {
                value: apiVersion,
            },
            _apiVersionMajor: {
                value: apiVersion.split('.')[0],
            },
            _customHeaders: {
                value: opts.customHeaders || {},
            },
            _endpointUrl: {
                value: opts.endpointUrl || Airtable.endpointUrl || defaultConfig.endpointUrl,
            },
            _noRetryIfRateLimited: {
                value: opts.noRetryIfRateLimited ||
                    Airtable.noRetryIfRateLimited ||
                    defaultConfig.noRetryIfRateLimited,
            },
            _requestTimeout: {
                value: opts.requestTimeout || Airtable.requestTimeout || defaultConfig.requestTimeout,
            },
        });
        if (!this._apiKey) {
            throw new Error('An API key is required to connect to Airtable');
        }
    }
    Airtable.prototype.base = function (baseId) {
        return base_1.default.createFunctor(this, baseId);
    };
    Airtable.default_config = function () {
        return {
            endpointUrl: process.env.AIRTABLE_ENDPOINT_URL || 'https://api.airtable.com',
            apiVersion: '0.1.0',
            apiKey: process.env.AIRTABLE_API_KEY,
            noRetryIfRateLimited: false,
            requestTimeout: 300 * 1000,
        };
    };
    Airtable.configure = function (_a) {
        var apiKey = _a.apiKey, endpointUrl = _a.endpointUrl, apiVersion = _a.apiVersion, noRetryIfRateLimited = _a.noRetryIfRateLimited, requestTimeout = _a.requestTimeout;
        Airtable.apiKey = apiKey;
        Airtable.endpointUrl = endpointUrl;
        Airtable.apiVersion = apiVersion;
        Airtable.noRetryIfRateLimited = noRetryIfRateLimited;
        Airtable.requestTimeout = requestTimeout;
    };
    Airtable.base = function (baseId) {
        return new Airtable().base(baseId);
    };
    Airtable.Base = base_1.default;
    Airtable.Record = record_1.default;
    Airtable.Table = table_1.default;
    Airtable.Error = airtable_error_1.default;
    return Airtable;
}());
module.exports = Airtable;

}).call(this)}).call(this,require('_process'))

},{"./airtable_error":6,"./base":7,"./record":19,"./table":21,"_process":99}],6:[function(require,module,exports){
"use strict";
var AirtableError = /** @class */ (function () {
    function AirtableError(error, message, statusCode) {
        this.error = error;
        this.message = message;
        this.statusCode = statusCode;
    }
    AirtableError.prototype.toString = function () {
        return [
            this.message,
            '(',
            this.error,
            ')',
            this.statusCode ? "[Http code " + this.statusCode + "]" : '',
        ].join('');
    };
    return AirtableError;
}());
module.exports = AirtableError;

},{}],7:[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var get_1 = __importDefault(require("lodash/get"));
var isPlainObject_1 = __importDefault(require("lodash/isPlainObject"));
var keys_1 = __importDefault(require("lodash/keys"));
var fetch_1 = __importDefault(require("./fetch"));
var abort_controller_1 = __importDefault(require("./abort-controller"));
var object_to_query_param_string_1 = __importDefault(require("./object_to_query_param_string"));
var airtable_error_1 = __importDefault(require("./airtable_error"));
var table_1 = __importDefault(require("./table"));
var http_headers_1 = __importDefault(require("./http_headers"));
var run_action_1 = __importDefault(require("./run_action"));
var package_version_1 = __importDefault(require("./package_version"));
var exponential_backoff_with_jitter_1 = __importDefault(require("./exponential_backoff_with_jitter"));
var userAgent = "Airtable.js/" + package_version_1.default;
var Base = /** @class */ (function () {
    function Base(airtable, baseId) {
        this._airtable = airtable;
        this._id = baseId;
    }
    Base.prototype.table = function (tableName) {
        return new table_1.default(this, null, tableName);
    };
    Base.prototype.makeRequest = function (options) {
        var _this = this;
        var _a;
        if (options === void 0) { options = {}; }
        var method = get_1.default(options, 'method', 'GET').toUpperCase();
        var url = this._airtable._endpointUrl + "/v" + this._airtable._apiVersionMajor + "/" + this._id + get_1.default(options, 'path', '/') + "?" + object_to_query_param_string_1.default(get_1.default(options, 'qs', {}));
        var controller = new abort_controller_1.default();
        var headers = this._getRequestHeaders(Object.assign({}, this._airtable._customHeaders, (_a = options.headers) !== null && _a !== void 0 ? _a : {}));
        var requestOptions = {
            method: method,
            headers: headers,
            signal: controller.signal,
        };
        if ('body' in options && _canRequestMethodIncludeBody(method)) {
            requestOptions.body = JSON.stringify(options.body);
        }
        var timeout = setTimeout(function () {
            controller.abort();
        }, this._airtable._requestTimeout);
        return new Promise(function (resolve, reject) {
            fetch_1.default(url, requestOptions)
                .then(function (resp) {
                clearTimeout(timeout);
                if (resp.status === 429 && !_this._airtable._noRetryIfRateLimited) {
                    var numAttempts_1 = get_1.default(options, '_numAttempts', 0);
                    var backoffDelayMs = exponential_backoff_with_jitter_1.default(numAttempts_1);
                    setTimeout(function () {
                        var newOptions = __assign(__assign({}, options), { _numAttempts: numAttempts_1 + 1 });
                        _this.makeRequest(newOptions)
                            .then(resolve)
                            .catch(reject);
                    }, backoffDelayMs);
                }
                else {
                    resp.json()
                        .then(function (body) {
                        var err = _this._checkStatusForError(resp.status, body) ||
                            _getErrorForNonObjectBody(resp.status, body);
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve({
                                statusCode: resp.status,
                                headers: resp.headers,
                                body: body,
                            });
                        }
                    })
                        .catch(function () {
                        var err = _getErrorForNonObjectBody(resp.status);
                        reject(err);
                    });
                }
            })
                .catch(function (err) {
                clearTimeout(timeout);
                err = new airtable_error_1.default('CONNECTION_ERROR', err.message, null);
                reject(err);
            });
        });
    };
    /**
     * @deprecated This method is deprecated.
     */
    Base.prototype.runAction = function (method, path, queryParams, bodyData, callback) {
        run_action_1.default(this, method, path, queryParams, bodyData, callback, 0);
    };
    Base.prototype._getRequestHeaders = function (headers) {
        var result = new http_headers_1.default();
        result.set('Authorization', "Bearer " + this._airtable._apiKey);
        result.set('User-Agent', userAgent);
        result.set('Content-Type', 'application/json');
        for (var _i = 0, _a = keys_1.default(headers); _i < _a.length; _i++) {
            var headerKey = _a[_i];
            result.set(headerKey, headers[headerKey]);
        }
        return result.toJSON();
    };
    Base.prototype._checkStatusForError = function (statusCode, body) {
        var _a = (body !== null && body !== void 0 ? body : { error: {} }).error, error = _a === void 0 ? {} : _a;
        var type = error.type, message = error.message;
        if (statusCode === 401) {
            return new airtable_error_1.default('AUTHENTICATION_REQUIRED', 'You should provide valid api key to perform this operation', statusCode);
        }
        else if (statusCode === 403) {
            return new airtable_error_1.default('NOT_AUTHORIZED', 'You are not authorized to perform this operation', statusCode);
        }
        else if (statusCode === 404) {
            return new airtable_error_1.default('NOT_FOUND', message !== null && message !== void 0 ? message : 'Could not find what you are looking for', statusCode);
        }
        else if (statusCode === 413) {
            return new airtable_error_1.default('REQUEST_TOO_LARGE', 'Request body is too large', statusCode);
        }
        else if (statusCode === 422) {
            return new airtable_error_1.default(type !== null && type !== void 0 ? type : 'UNPROCESSABLE_ENTITY', message !== null && message !== void 0 ? message : 'The operation cannot be processed', statusCode);
        }
        else if (statusCode === 429) {
            return new airtable_error_1.default('TOO_MANY_REQUESTS', 'You have made too many requests in a short period of time. Please retry your request later', statusCode);
        }
        else if (statusCode === 500) {
            return new airtable_error_1.default('SERVER_ERROR', 'Try again. If the problem persists, contact support.', statusCode);
        }
        else if (statusCode === 503) {
            return new airtable_error_1.default('SERVICE_UNAVAILABLE', 'The service is temporarily unavailable. Please retry shortly.', statusCode);
        }
        else if (statusCode >= 400) {
            return new airtable_error_1.default(type !== null && type !== void 0 ? type : 'UNEXPECTED_ERROR', message !== null && message !== void 0 ? message : 'An unexpected error occurred', statusCode);
        }
        else {
            return null;
        }
    };
    Base.prototype.doCall = function (tableName) {
        return this.table(tableName);
    };
    Base.prototype.getId = function () {
        return this._id;
    };
    Base.createFunctor = function (airtable, baseId) {
        var base = new Base(airtable, baseId);
        var baseFn = function (tableName) {
            return base.doCall(tableName);
        };
        baseFn._base = base;
        baseFn.table = base.table.bind(base);
        baseFn.makeRequest = base.makeRequest.bind(base);
        baseFn.runAction = base.runAction.bind(base);
        baseFn.getId = base.getId.bind(base);
        return baseFn;
    };
    return Base;
}());
function _canRequestMethodIncludeBody(method) {
    return method !== 'GET' && method !== 'DELETE';
}
function _getErrorForNonObjectBody(statusCode, body) {
    if (isPlainObject_1.default(body)) {
        return null;
    }
    else {
        return new airtable_error_1.default('UNEXPECTED_ERROR', 'The response from Airtable was invalid JSON. Please try again soon.', statusCode);
    }
}
module.exports = Base;

},{"./abort-controller":4,"./airtable_error":6,"./exponential_backoff_with_jitter":10,"./fetch":11,"./http_headers":13,"./object_to_query_param_string":15,"./package_version":16,"./run_action":20,"./table":21,"lodash/get":80,"lodash/isPlainObject":91,"lodash/keys":95}],8:[function(require,module,exports){
"use strict";
/**
 * Given a function fn that takes a callback as its last argument, returns
 * a new version of the function that takes the callback optionally. If
 * the function is not called with a callback for the last argument, the
 * function will return a promise instead.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types */
function callbackToPromise(fn, context, callbackArgIndex) {
    if (callbackArgIndex === void 0) { callbackArgIndex = void 0; }
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types */
    return function () {
        var callArgs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            callArgs[_i] = arguments[_i];
        }
        var thisCallbackArgIndex;
        if (callbackArgIndex === void 0) {
            // istanbul ignore next
            thisCallbackArgIndex = callArgs.length > 0 ? callArgs.length - 1 : 0;
        }
        else {
            thisCallbackArgIndex = callbackArgIndex;
        }
        var callbackArg = callArgs[thisCallbackArgIndex];
        if (typeof callbackArg === 'function') {
            fn.apply(context, callArgs);
            return void 0;
        }
        else {
            var args_1 = [];
            // If an explicit callbackArgIndex is set, but the function is called
            // with too few arguments, we want to push undefined onto args so that
            // our constructed callback ends up at the right index.
            var argLen = Math.max(callArgs.length, thisCallbackArgIndex);
            for (var i = 0; i < argLen; i++) {
                args_1.push(callArgs[i]);
            }
            return new Promise(function (resolve, reject) {
                args_1.push(function (err, result) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(result);
                    }
                });
                fn.apply(context, args_1);
            });
        }
    };
}
module.exports = callbackToPromise;

},{}],9:[function(require,module,exports){
"use strict";
var didWarnForDeprecation = {};
/**
 * Convenience function for marking a function as deprecated.
 *
 * Will emit a warning the first time that function is called.
 *
 * @param fn the function to mark as deprecated.
 * @param key a unique key identifying the function.
 * @param message the warning message.
 *
 * @return a wrapped function
 */
function deprecate(fn, key, message) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (!didWarnForDeprecation[key]) {
            didWarnForDeprecation[key] = true;
            console.warn(message);
        }
        fn.apply(this, args);
    };
}
module.exports = deprecate;

},{}],10:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var internal_config_json_1 = __importDefault(require("./internal_config.json"));
// "Full Jitter" algorithm taken from https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
function exponentialBackoffWithJitter(numberOfRetries) {
    var rawBackoffTimeMs = internal_config_json_1.default.INITIAL_RETRY_DELAY_IF_RATE_LIMITED * Math.pow(2, numberOfRetries);
    var clippedBackoffTimeMs = Math.min(internal_config_json_1.default.MAX_RETRY_DELAY_IF_RATE_LIMITED, rawBackoffTimeMs);
    var jitteredBackoffTimeMs = Math.random() * clippedBackoffTimeMs;
    return jitteredBackoffTimeMs;
}
module.exports = exponentialBackoffWithJitter;

},{"./internal_config.json":14}],11:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
// istanbul ignore file
var node_fetch_1 = __importDefault(require("node-fetch"));
module.exports = typeof window === 'undefined' ? node_fetch_1.default : window.fetch.bind(window);

},{"node-fetch":23}],12:[function(require,module,exports){
"use strict";
/* eslint-enable @typescript-eslint/no-explicit-any */
function has(object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
}
module.exports = has;

},{}],13:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var keys_1 = __importDefault(require("lodash/keys"));
var isBrowser = typeof window !== 'undefined';
var HttpHeaders = /** @class */ (function () {
    function HttpHeaders() {
        this._headersByLowercasedKey = {};
    }
    HttpHeaders.prototype.set = function (headerKey, headerValue) {
        var lowercasedKey = headerKey.toLowerCase();
        if (lowercasedKey === 'x-airtable-user-agent') {
            lowercasedKey = 'user-agent';
            headerKey = 'User-Agent';
        }
        this._headersByLowercasedKey[lowercasedKey] = {
            headerKey: headerKey,
            headerValue: headerValue,
        };
    };
    HttpHeaders.prototype.toJSON = function () {
        var result = {};
        for (var _i = 0, _a = keys_1.default(this._headersByLowercasedKey); _i < _a.length; _i++) {
            var lowercasedKey = _a[_i];
            var headerDefinition = this._headersByLowercasedKey[lowercasedKey];
            var headerKey = void 0;
            /* istanbul ignore next */
            if (isBrowser && lowercasedKey === 'user-agent') {
                // Some browsers do not allow overriding the user agent.
                // https://github.com/Airtable/airtable.js/issues/52
                headerKey = 'X-Airtable-User-Agent';
            }
            else {
                headerKey = headerDefinition.headerKey;
            }
            result[headerKey] = headerDefinition.headerValue;
        }
        return result;
    };
    return HttpHeaders;
}());
module.exports = HttpHeaders;

},{"lodash/keys":95}],14:[function(require,module,exports){
module.exports={
    "INITIAL_RETRY_DELAY_IF_RATE_LIMITED": 5000,
    "MAX_RETRY_DELAY_IF_RATE_LIMITED": 600000
}

},{}],15:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var isArray_1 = __importDefault(require("lodash/isArray"));
var isNil_1 = __importDefault(require("lodash/isNil"));
var keys_1 = __importDefault(require("lodash/keys"));
/* eslint-enable @typescript-eslint/no-explicit-any */
// Adapted from jQuery.param:
// https://github.com/jquery/jquery/blob/2.2-stable/src/serialize.js
function buildParams(prefix, obj, addFn) {
    if (isArray_1.default(obj)) {
        // Serialize array item.
        for (var index = 0; index < obj.length; index++) {
            var value = obj[index];
            if (/\[\]$/.test(prefix)) {
                // Treat each array item as a scalar.
                addFn(prefix, value);
            }
            else {
                // Item is non-scalar (array or object), encode its numeric index.
                buildParams(prefix + "[" + (typeof value === 'object' && value !== null ? index : '') + "]", value, addFn);
            }
        }
    }
    else if (typeof obj === 'object') {
        // Serialize object item.
        for (var _i = 0, _a = keys_1.default(obj); _i < _a.length; _i++) {
            var key = _a[_i];
            var value = obj[key];
            buildParams(prefix + "[" + key + "]", value, addFn);
        }
    }
    else {
        // Serialize scalar item.
        addFn(prefix, obj);
    }
}
function objectToQueryParamString(obj) {
    var parts = [];
    var addFn = function (key, value) {
        value = isNil_1.default(value) ? '' : value;
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
    };
    for (var _i = 0, _a = keys_1.default(obj); _i < _a.length; _i++) {
        var key = _a[_i];
        var value = obj[key];
        buildParams(key, value, addFn);
    }
    return parts.join('&').replace(/%20/g, '+');
}
module.exports = objectToQueryParamString;

},{"lodash/isArray":82,"lodash/isNil":87,"lodash/keys":95}],16:[function(require,module,exports){
(function (process){(function (){
"use strict";
module.exports = process.env.npm_package_version;

}).call(this)}).call(this,require('_process'))

},{"_process":99}],17:[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var isFunction_1 = __importDefault(require("lodash/isFunction"));
var keys_1 = __importDefault(require("lodash/keys"));
var record_1 = __importDefault(require("./record"));
var callback_to_promise_1 = __importDefault(require("./callback_to_promise"));
var has_1 = __importDefault(require("./has"));
var query_params_1 = require("./query_params");
/**
 * Builds a query object. Won't fetch until `firstPage` or
 * or `eachPage` is called.
 *
 * Params should be validated prior to being passed to Query
 * with `Query.validateParams`.
 */
var Query = /** @class */ (function () {
    function Query(table, params) {
        this._table = table;
        this._params = params;
        this.firstPage = callback_to_promise_1.default(firstPage, this);
        this.eachPage = callback_to_promise_1.default(eachPage, this, 1);
        this.all = callback_to_promise_1.default(all, this);
    }
    /**
     * Validates the parameters for passing to the Query constructor.
     *
     * @params {object} params parameters to validate
     *
     * @return an object with two keys:
     *  validParams: the object that should be passed to the constructor.
     *  ignoredKeys: a list of keys that will be ignored.
     *  errors: a list of error messages.
     */
    Query.validateParams = function (params) {
        var validParams = {};
        var ignoredKeys = [];
        var errors = [];
        for (var _i = 0, _a = keys_1.default(params); _i < _a.length; _i++) {
            var key = _a[_i];
            var value = params[key];
            if (has_1.default(Query.paramValidators, key)) {
                var validator = Query.paramValidators[key];
                var validationResult = validator(value);
                if (validationResult.pass) {
                    validParams[key] = value;
                }
                else {
                    errors.push(validationResult.error);
                }
            }
            else {
                ignoredKeys.push(key);
            }
        }
        return {
            validParams: validParams,
            ignoredKeys: ignoredKeys,
            errors: errors,
        };
    };
    Query.paramValidators = query_params_1.paramValidators;
    return Query;
}());
/**
 * Fetches the first page of results for the query asynchronously,
 * then calls `done(error, records)`.
 */
function firstPage(done) {
    if (!isFunction_1.default(done)) {
        throw new Error('The first parameter to `firstPage` must be a function');
    }
    this.eachPage(function (records) {
        done(null, records);
    }, function (error) {
        done(error, null);
    });
}
/**
 * Fetches each page of results for the query asynchronously.
 *
 * Calls `pageCallback(records, fetchNextPage)` for each
 * page. You must call `fetchNextPage()` to fetch the next page of
 * results.
 *
 * After fetching all pages, or if there's an error, calls
 * `done(error)`.
 */
function eachPage(pageCallback, done) {
    var _this = this;
    if (!isFunction_1.default(pageCallback)) {
        throw new Error('The first parameter to `eachPage` must be a function');
    }
    if (!isFunction_1.default(done) && done !== void 0) {
        throw new Error('The second parameter to `eachPage` must be a function or undefined');
    }
    var path = "/" + this._table._urlEncodedNameOrId();
    var params = __assign({}, this._params);
    var inner = function () {
        _this._table._base.runAction('get', path, params, null, function (err, response, result) {
            if (err) {
                done(err, null);
            }
            else {
                var next = void 0;
                if (result.offset) {
                    params.offset = result.offset;
                    next = inner;
                }
                else {
                    next = function () {
                        done(null);
                    };
                }
                var records = result.records.map(function (recordJson) {
                    return new record_1.default(_this._table, null, recordJson);
                });
                pageCallback(records, next);
            }
        });
    };
    inner();
}
/**
 * Fetches all pages of results asynchronously. May take a long time.
 */
function all(done) {
    if (!isFunction_1.default(done)) {
        throw new Error('The first parameter to `all` must be a function');
    }
    var allRecords = [];
    this.eachPage(function (pageRecords, fetchNextPage) {
        allRecords.push.apply(allRecords, pageRecords);
        fetchNextPage();
    }, function (err) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, allRecords);
        }
    });
}
module.exports = Query;

},{"./callback_to_promise":8,"./has":12,"./query_params":18,"./record":19,"lodash/isFunction":85,"lodash/keys":95}],18:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paramValidators = void 0;
var typecheck_1 = __importDefault(require("./typecheck"));
var isString_1 = __importDefault(require("lodash/isString"));
var isNumber_1 = __importDefault(require("lodash/isNumber"));
var isPlainObject_1 = __importDefault(require("lodash/isPlainObject"));
exports.paramValidators = {
    fields: typecheck_1.default(typecheck_1.default.isArrayOf(isString_1.default), 'the value for `fields` should be an array of strings'),
    filterByFormula: typecheck_1.default(isString_1.default, 'the value for `filterByFormula` should be a string'),
    maxRecords: typecheck_1.default(isNumber_1.default, 'the value for `maxRecords` should be a number'),
    pageSize: typecheck_1.default(isNumber_1.default, 'the value for `pageSize` should be a number'),
    offset: typecheck_1.default(isNumber_1.default, 'the value for `offset` should be a number'),
    sort: typecheck_1.default(typecheck_1.default.isArrayOf(function (obj) {
        return (isPlainObject_1.default(obj) &&
            isString_1.default(obj.field) &&
            (obj.direction === void 0 || ['asc', 'desc'].includes(obj.direction)));
    }), 'the value for `sort` should be an array of sort objects. ' +
        'Each sort object must have a string `field` value, and an optional ' +
        '`direction` value that is "asc" or "desc".'),
    view: typecheck_1.default(isString_1.default, 'the value for `view` should be a string'),
    cellFormat: typecheck_1.default(function (cellFormat) {
        return isString_1.default(cellFormat) && ['json', 'string'].includes(cellFormat);
    }, 'the value for `cellFormat` should be "json" or "string"'),
    timeZone: typecheck_1.default(isString_1.default, 'the value for `timeZone` should be a string'),
    userLocale: typecheck_1.default(isString_1.default, 'the value for `userLocale` should be a string'),
};

},{"./typecheck":22,"lodash/isNumber":88,"lodash/isPlainObject":91,"lodash/isString":92}],19:[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var callback_to_promise_1 = __importDefault(require("./callback_to_promise"));
var Record = /** @class */ (function () {
    function Record(table, recordId, recordJson) {
        this._table = table;
        this.id = recordId || recordJson.id;
        this.setRawJson(recordJson);
        this.save = callback_to_promise_1.default(save, this);
        this.patchUpdate = callback_to_promise_1.default(patchUpdate, this);
        this.putUpdate = callback_to_promise_1.default(putUpdate, this);
        this.destroy = callback_to_promise_1.default(destroy, this);
        this.fetch = callback_to_promise_1.default(fetch, this);
        this.updateFields = this.patchUpdate;
        this.replaceFields = this.putUpdate;
    }
    Record.prototype.getId = function () {
        return this.id;
    };
    Record.prototype.get = function (columnName) {
        return this.fields[columnName];
    };
    Record.prototype.set = function (columnName, columnValue) {
        this.fields[columnName] = columnValue;
    };
    Record.prototype.setRawJson = function (rawJson) {
        this._rawJson = rawJson;
        this.fields = (this._rawJson && this._rawJson.fields) || {};
    };
    return Record;
}());
function save(done) {
    this.putUpdate(this.fields, done);
}
function patchUpdate(cellValuesByName, opts, done) {
    var _this = this;
    if (!done) {
        done = opts;
        opts = {};
    }
    var updateBody = __assign({ fields: cellValuesByName }, opts);
    this._table._base.runAction('patch', "/" + this._table._urlEncodedNameOrId() + "/" + this.id, {}, updateBody, function (err, response, results) {
        if (err) {
            done(err);
            return;
        }
        _this.setRawJson(results);
        done(null, _this);
    });
}
function putUpdate(cellValuesByName, opts, done) {
    var _this = this;
    if (!done) {
        done = opts;
        opts = {};
    }
    var updateBody = __assign({ fields: cellValuesByName }, opts);
    this._table._base.runAction('put', "/" + this._table._urlEncodedNameOrId() + "/" + this.id, {}, updateBody, function (err, response, results) {
        if (err) {
            done(err);
            return;
        }
        _this.setRawJson(results);
        done(null, _this);
    });
}
function destroy(done) {
    var _this = this;
    this._table._base.runAction('delete', "/" + this._table._urlEncodedNameOrId() + "/" + this.id, {}, null, function (err) {
        if (err) {
            done(err);
            return;
        }
        done(null, _this);
    });
}
function fetch(done) {
    var _this = this;
    this._table._base.runAction('get', "/" + this._table._urlEncodedNameOrId() + "/" + this.id, {}, null, function (err, response, results) {
        if (err) {
            done(err);
            return;
        }
        _this.setRawJson(results);
        done(null, _this);
    });
}
module.exports = Record;

},{"./callback_to_promise":8}],20:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var exponential_backoff_with_jitter_1 = __importDefault(require("./exponential_backoff_with_jitter"));
var object_to_query_param_string_1 = __importDefault(require("./object_to_query_param_string"));
var package_version_1 = __importDefault(require("./package_version"));
var fetch_1 = __importDefault(require("./fetch"));
var abort_controller_1 = __importDefault(require("./abort-controller"));
var userAgent = "Airtable.js/" + package_version_1.default;
function runAction(base, method, path, queryParams, bodyData, callback, numAttempts) {
    var url = base._airtable._endpointUrl + "/v" + base._airtable._apiVersionMajor + "/" + base._id + path + "?" + object_to_query_param_string_1.default(queryParams);
    var headers = {
        authorization: "Bearer " + base._airtable._apiKey,
        'x-api-version': base._airtable._apiVersion,
        'x-airtable-application-id': base.getId(),
        'content-type': 'application/json',
    };
    var isBrowser = typeof window !== 'undefined';
    // Some browsers do not allow overriding the user agent.
    // https://github.com/Airtable/airtable.js/issues/52
    if (isBrowser) {
        headers['x-airtable-user-agent'] = userAgent;
    }
    else {
        headers['User-Agent'] = userAgent;
    }
    var controller = new abort_controller_1.default();
    var normalizedMethod = method.toUpperCase();
    var options = {
        method: normalizedMethod,
        headers: headers,
        signal: controller.signal,
    };
    if (bodyData !== null) {
        if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') {
            console.warn('body argument to runAction are ignored with GET or HEAD requests');
        }
        else {
            options.body = JSON.stringify(bodyData);
        }
    }
    var timeout = setTimeout(function () {
        controller.abort();
    }, base._airtable._requestTimeout);
    fetch_1.default(url, options)
        .then(function (resp) {
        clearTimeout(timeout);
        if (resp.status === 429 && !base._airtable._noRetryIfRateLimited) {
            var backoffDelayMs = exponential_backoff_with_jitter_1.default(numAttempts);
            setTimeout(function () {
                runAction(base, method, path, queryParams, bodyData, callback, numAttempts + 1);
            }, backoffDelayMs);
        }
        else {
            resp.json()
                .then(function (body) {
                var error = base._checkStatusForError(resp.status, body);
                // Ensure Response interface matches interface from
                // `request` Response object
                var r = {};
                Object.keys(resp).forEach(function (property) {
                    r[property] = resp[property];
                });
                r.body = body;
                r.statusCode = resp.status;
                callback(error, r, body);
            })
                .catch(function () {
                callback(base._checkStatusForError(resp.status));
            });
        }
    })
        .catch(function (error) {
        clearTimeout(timeout);
        callback(error);
    });
}
module.exports = runAction;

},{"./abort-controller":4,"./exponential_backoff_with_jitter":10,"./fetch":11,"./object_to_query_param_string":15,"./package_version":16}],21:[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var isPlainObject_1 = __importDefault(require("lodash/isPlainObject"));
var deprecate_1 = __importDefault(require("./deprecate"));
var query_1 = __importDefault(require("./query"));
var record_1 = __importDefault(require("./record"));
var callback_to_promise_1 = __importDefault(require("./callback_to_promise"));
var Table = /** @class */ (function () {
    function Table(base, tableId, tableName) {
        if (!tableId && !tableName) {
            throw new Error('Table name or table ID is required');
        }
        this._base = base;
        this.id = tableId;
        this.name = tableName;
        // Public API
        this.find = callback_to_promise_1.default(this._findRecordById, this);
        this.select = this._selectRecords.bind(this);
        this.create = callback_to_promise_1.default(this._createRecords, this);
        this.update = callback_to_promise_1.default(this._updateRecords.bind(this, false), this);
        this.replace = callback_to_promise_1.default(this._updateRecords.bind(this, true), this);
        this.destroy = callback_to_promise_1.default(this._destroyRecord, this);
        // Deprecated API
        this.list = deprecate_1.default(this._listRecords.bind(this), 'table.list', 'Airtable: `list()` is deprecated. Use `select()` instead.');
        this.forEach = deprecate_1.default(this._forEachRecord.bind(this), 'table.forEach', 'Airtable: `forEach()` is deprecated. Use `select()` instead.');
    }
    Table.prototype._findRecordById = function (recordId, done) {
        var record = new record_1.default(this, recordId);
        record.fetch(done);
    };
    Table.prototype._selectRecords = function (params) {
        if (params === void 0) {
            params = {};
        }
        if (arguments.length > 1) {
            console.warn("Airtable: `select` takes only one parameter, but it was given " + arguments.length + " parameters. Use `eachPage` or `firstPage` to fetch records.");
        }
        if (isPlainObject_1.default(params)) {
            var validationResults = query_1.default.validateParams(params);
            if (validationResults.errors.length) {
                var formattedErrors = validationResults.errors.map(function (error) {
                    return "  * " + error;
                });
                throw new Error("Airtable: invalid parameters for `select`:\n" + formattedErrors.join('\n'));
            }
            if (validationResults.ignoredKeys.length) {
                console.warn("Airtable: the following parameters to `select` will be ignored: " + validationResults.ignoredKeys.join(', '));
            }
            return new query_1.default(this, validationResults.validParams);
        }
        else {
            throw new Error('Airtable: the parameter for `select` should be a plain object or undefined.');
        }
    };
    Table.prototype._urlEncodedNameOrId = function () {
        return this.id || encodeURIComponent(this.name);
    };
    Table.prototype._createRecords = function (recordsData, optionalParameters, done) {
        var _this = this;
        var isCreatingMultipleRecords = Array.isArray(recordsData);
        if (!done) {
            done = optionalParameters;
            optionalParameters = {};
        }
        var requestData;
        if (isCreatingMultipleRecords) {
            requestData = __assign({ records: recordsData }, optionalParameters);
        }
        else {
            requestData = __assign({ fields: recordsData }, optionalParameters);
        }
        this._base.runAction('post', "/" + this._urlEncodedNameOrId() + "/", {}, requestData, function (err, resp, body) {
            if (err) {
                done(err);
                return;
            }
            var result;
            if (isCreatingMultipleRecords) {
                result = body.records.map(function (record) {
                    return new record_1.default(_this, record.id, record);
                });
            }
            else {
                result = new record_1.default(_this, body.id, body);
            }
            done(null, result);
        });
    };
    Table.prototype._updateRecords = function (isDestructiveUpdate, recordsDataOrRecordId, recordDataOrOptsOrDone, optsOrDone, done) {
        var _this = this;
        var opts;
        if (Array.isArray(recordsDataOrRecordId)) {
            var recordsData = recordsDataOrRecordId;
            opts = isPlainObject_1.default(recordDataOrOptsOrDone) ? recordDataOrOptsOrDone : {};
            done = (optsOrDone || recordDataOrOptsOrDone);
            var method = isDestructiveUpdate ? 'put' : 'patch';
            var requestData = __assign({ records: recordsData }, opts);
            this._base.runAction(method, "/" + this._urlEncodedNameOrId() + "/", {}, requestData, function (err, resp, body) {
                if (err) {
                    done(err);
                    return;
                }
                var result = body.records.map(function (record) {
                    return new record_1.default(_this, record.id, record);
                });
                done(null, result);
            });
        }
        else {
            var recordId = recordsDataOrRecordId;
            var recordData = recordDataOrOptsOrDone;
            opts = isPlainObject_1.default(optsOrDone) ? optsOrDone : {};
            done = (done || optsOrDone);
            var record = new record_1.default(this, recordId);
            if (isDestructiveUpdate) {
                record.putUpdate(recordData, opts, done);
            }
            else {
                record.patchUpdate(recordData, opts, done);
            }
        }
    };
    Table.prototype._destroyRecord = function (recordIdsOrId, done) {
        var _this = this;
        if (Array.isArray(recordIdsOrId)) {
            var queryParams = { records: recordIdsOrId };
            this._base.runAction('delete', "/" + this._urlEncodedNameOrId(), queryParams, null, function (err, response, results) {
                if (err) {
                    done(err);
                    return;
                }
                var records = results.records.map(function (_a) {
                    var id = _a.id;
                    return new record_1.default(_this, id, null);
                });
                done(null, records);
            });
        }
        else {
            var record = new record_1.default(this, recordIdsOrId);
            record.destroy(done);
        }
    };
    Table.prototype._listRecords = function (limit, offset, opts, done) {
        var _this = this;
        if (!done) {
            done = opts;
            opts = {};
        }
        var listRecordsParameters = __assign({ limit: limit,
            offset: offset }, opts);
        this._base.runAction('get', "/" + this._urlEncodedNameOrId() + "/", listRecordsParameters, null, function (err, response, results) {
            if (err) {
                done(err);
                return;
            }
            var records = results.records.map(function (recordJson) {
                return new record_1.default(_this, null, recordJson);
            });
            done(null, records, results.offset);
        });
    };
    Table.prototype._forEachRecord = function (opts, callback, done) {
        var _this = this;
        if (arguments.length === 2) {
            done = callback;
            callback = opts;
            opts = {};
        }
        var limit = Table.__recordsPerPageForIteration || 100;
        var offset = null;
        var nextPage = function () {
            _this._listRecords(limit, offset, opts, function (err, page, newOffset) {
                if (err) {
                    done(err);
                    return;
                }
                for (var index = 0; index < page.length; index++) {
                    callback(page[index]);
                }
                if (newOffset) {
                    offset = newOffset;
                    nextPage();
                }
                else {
                    done();
                }
            });
        };
        nextPage();
    };
    return Table;
}());
module.exports = Table;

},{"./callback_to_promise":8,"./deprecate":9,"./query":17,"./record":19,"lodash/isPlainObject":91}],22:[function(require,module,exports){
"use strict";
/* eslint-enable @typescript-eslint/no-explicit-any */
function check(fn, error) {
    return function (value) {
        if (fn(value)) {
            return { pass: true };
        }
        else {
            return { pass: false, error: error };
        }
    };
}
check.isOneOf = function isOneOf(options) {
    return options.includes.bind(options);
};
check.isArrayOf = function (itemValidator) {
    return function (value) {
        return Array.isArray(value) && value.every(itemValidator);
    };
};
module.exports = check;

},{}],23:[function(require,module,exports){

},{}],24:[function(require,module,exports){
var hashClear = require('./_hashClear'),
    hashDelete = require('./_hashDelete'),
    hashGet = require('./_hashGet'),
    hashHas = require('./_hashHas'),
    hashSet = require('./_hashSet');

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

module.exports = Hash;

},{"./_hashClear":49,"./_hashDelete":50,"./_hashGet":51,"./_hashHas":52,"./_hashSet":53}],25:[function(require,module,exports){
var listCacheClear = require('./_listCacheClear'),
    listCacheDelete = require('./_listCacheDelete'),
    listCacheGet = require('./_listCacheGet'),
    listCacheHas = require('./_listCacheHas'),
    listCacheSet = require('./_listCacheSet');

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

module.exports = ListCache;

},{"./_listCacheClear":59,"./_listCacheDelete":60,"./_listCacheGet":61,"./_listCacheHas":62,"./_listCacheSet":63}],26:[function(require,module,exports){
var getNative = require('./_getNative'),
    root = require('./_root');

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map');

module.exports = Map;

},{"./_getNative":45,"./_root":75}],27:[function(require,module,exports){
var mapCacheClear = require('./_mapCacheClear'),
    mapCacheDelete = require('./_mapCacheDelete'),
    mapCacheGet = require('./_mapCacheGet'),
    mapCacheHas = require('./_mapCacheHas'),
    mapCacheSet = require('./_mapCacheSet');

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

module.exports = MapCache;

},{"./_mapCacheClear":64,"./_mapCacheDelete":65,"./_mapCacheGet":66,"./_mapCacheHas":67,"./_mapCacheSet":68}],28:[function(require,module,exports){
var root = require('./_root');

/** Built-in value references. */
var Symbol = root.Symbol;

module.exports = Symbol;

},{"./_root":75}],29:[function(require,module,exports){
var baseTimes = require('./_baseTimes'),
    isArguments = require('./isArguments'),
    isArray = require('./isArray'),
    isBuffer = require('./isBuffer'),
    isIndex = require('./_isIndex'),
    isTypedArray = require('./isTypedArray');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = arrayLikeKeys;

},{"./_baseTimes":38,"./_isIndex":54,"./isArguments":81,"./isArray":82,"./isBuffer":84,"./isTypedArray":94}],30:[function(require,module,exports){
/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array == null ? 0 : array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

module.exports = arrayMap;

},{}],31:[function(require,module,exports){
var eq = require('./eq');

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

module.exports = assocIndexOf;

},{"./eq":79}],32:[function(require,module,exports){
var castPath = require('./_castPath'),
    toKey = require('./_toKey');

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = castPath(path, object);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[toKey(path[index++])];
  }
  return (index && index == length) ? object : undefined;
}

module.exports = baseGet;

},{"./_castPath":41,"./_toKey":77}],33:[function(require,module,exports){
var Symbol = require('./_Symbol'),
    getRawTag = require('./_getRawTag'),
    objectToString = require('./_objectToString');

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

module.exports = baseGetTag;

},{"./_Symbol":28,"./_getRawTag":47,"./_objectToString":73}],34:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var argsTag = '[object Arguments]';

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag;
}

module.exports = baseIsArguments;

},{"./_baseGetTag":33,"./isObjectLike":90}],35:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isMasked = require('./_isMasked'),
    isObject = require('./isObject'),
    toSource = require('./_toSource');

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

module.exports = baseIsNative;

},{"./_isMasked":57,"./_toSource":78,"./isFunction":85,"./isObject":89}],36:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isLength = require('./isLength'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

module.exports = baseIsTypedArray;

},{"./_baseGetTag":33,"./isLength":86,"./isObjectLike":90}],37:[function(require,module,exports){
var isPrototype = require('./_isPrototype'),
    nativeKeys = require('./_nativeKeys');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

module.exports = baseKeys;

},{"./_isPrototype":58,"./_nativeKeys":71}],38:[function(require,module,exports){
/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

module.exports = baseTimes;

},{}],39:[function(require,module,exports){
var Symbol = require('./_Symbol'),
    arrayMap = require('./_arrayMap'),
    isArray = require('./isArray'),
    isSymbol = require('./isSymbol');

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isArray(value)) {
    // Recursively convert values (susceptible to call stack limits).
    return arrayMap(value, baseToString) + '';
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = baseToString;

},{"./_Symbol":28,"./_arrayMap":30,"./isArray":82,"./isSymbol":93}],40:[function(require,module,exports){
/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

module.exports = baseUnary;

},{}],41:[function(require,module,exports){
var isArray = require('./isArray'),
    isKey = require('./_isKey'),
    stringToPath = require('./_stringToPath'),
    toString = require('./toString');

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @param {Object} [object] The object to query keys on.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value, object) {
  if (isArray(value)) {
    return value;
  }
  return isKey(value, object) ? [value] : stringToPath(toString(value));
}

module.exports = castPath;

},{"./_isKey":55,"./_stringToPath":76,"./isArray":82,"./toString":98}],42:[function(require,module,exports){
var root = require('./_root');

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

module.exports = coreJsData;

},{"./_root":75}],43:[function(require,module,exports){
(function (global){(function (){
/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

module.exports = freeGlobal;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],44:[function(require,module,exports){
var isKeyable = require('./_isKeyable');

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

module.exports = getMapData;

},{"./_isKeyable":56}],45:[function(require,module,exports){
var baseIsNative = require('./_baseIsNative'),
    getValue = require('./_getValue');

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

module.exports = getNative;

},{"./_baseIsNative":35,"./_getValue":48}],46:[function(require,module,exports){
var overArg = require('./_overArg');

/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);

module.exports = getPrototype;

},{"./_overArg":74}],47:[function(require,module,exports){
var Symbol = require('./_Symbol');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

module.exports = getRawTag;

},{"./_Symbol":28}],48:[function(require,module,exports){
/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

module.exports = getValue;

},{}],49:[function(require,module,exports){
var nativeCreate = require('./_nativeCreate');

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
  this.size = 0;
}

module.exports = hashClear;

},{"./_nativeCreate":70}],50:[function(require,module,exports){
/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = hashDelete;

},{}],51:[function(require,module,exports){
var nativeCreate = require('./_nativeCreate');

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

module.exports = hashGet;

},{"./_nativeCreate":70}],52:[function(require,module,exports){
var nativeCreate = require('./_nativeCreate');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? (data[key] !== undefined) : hasOwnProperty.call(data, key);
}

module.exports = hashHas;

},{"./_nativeCreate":70}],53:[function(require,module,exports){
var nativeCreate = require('./_nativeCreate');

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

module.exports = hashSet;

},{"./_nativeCreate":70}],54:[function(require,module,exports){
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER : length;

  return !!length &&
    (type == 'number' ||
      (type != 'symbol' && reIsUint.test(value))) &&
        (value > -1 && value % 1 == 0 && value < length);
}

module.exports = isIndex;

},{}],55:[function(require,module,exports){
var isArray = require('./isArray'),
    isSymbol = require('./isSymbol');

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/;

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (isArray(value)) {
    return false;
  }
  var type = typeof value;
  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
      value == null || isSymbol(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
    (object != null && value in Object(object));
}

module.exports = isKey;

},{"./isArray":82,"./isSymbol":93}],56:[function(require,module,exports){
/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

module.exports = isKeyable;

},{}],57:[function(require,module,exports){
var coreJsData = require('./_coreJsData');

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

module.exports = isMasked;

},{"./_coreJsData":42}],58:[function(require,module,exports){
/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

module.exports = isPrototype;

},{}],59:[function(require,module,exports){
/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

module.exports = listCacheClear;

},{}],60:[function(require,module,exports){
var assocIndexOf = require('./_assocIndexOf');

/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}

module.exports = listCacheDelete;

},{"./_assocIndexOf":31}],61:[function(require,module,exports){
var assocIndexOf = require('./_assocIndexOf');

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

module.exports = listCacheGet;

},{"./_assocIndexOf":31}],62:[function(require,module,exports){
var assocIndexOf = require('./_assocIndexOf');

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

module.exports = listCacheHas;

},{"./_assocIndexOf":31}],63:[function(require,module,exports){
var assocIndexOf = require('./_assocIndexOf');

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

module.exports = listCacheSet;

},{"./_assocIndexOf":31}],64:[function(require,module,exports){
var Hash = require('./_Hash'),
    ListCache = require('./_ListCache'),
    Map = require('./_Map');

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

module.exports = mapCacheClear;

},{"./_Hash":24,"./_ListCache":25,"./_Map":26}],65:[function(require,module,exports){
var getMapData = require('./_getMapData');

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = mapCacheDelete;

},{"./_getMapData":44}],66:[function(require,module,exports){
var getMapData = require('./_getMapData');

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

module.exports = mapCacheGet;

},{"./_getMapData":44}],67:[function(require,module,exports){
var getMapData = require('./_getMapData');

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

module.exports = mapCacheHas;

},{"./_getMapData":44}],68:[function(require,module,exports){
var getMapData = require('./_getMapData');

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

module.exports = mapCacheSet;

},{"./_getMapData":44}],69:[function(require,module,exports){
var memoize = require('./memoize');

/** Used as the maximum memoize cache size. */
var MAX_MEMOIZE_SIZE = 500;

/**
 * A specialized version of `_.memoize` which clears the memoized function's
 * cache when it exceeds `MAX_MEMOIZE_SIZE`.
 *
 * @private
 * @param {Function} func The function to have its output memoized.
 * @returns {Function} Returns the new memoized function.
 */
function memoizeCapped(func) {
  var result = memoize(func, function(key) {
    if (cache.size === MAX_MEMOIZE_SIZE) {
      cache.clear();
    }
    return key;
  });

  var cache = result.cache;
  return result;
}

module.exports = memoizeCapped;

},{"./memoize":96}],70:[function(require,module,exports){
var getNative = require('./_getNative');

/* Built-in method references that are verified to be native. */
var nativeCreate = getNative(Object, 'create');

module.exports = nativeCreate;

},{"./_getNative":45}],71:[function(require,module,exports){
var overArg = require('./_overArg');

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

module.exports = nativeKeys;

},{"./_overArg":74}],72:[function(require,module,exports){
var freeGlobal = require('./_freeGlobal');

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    // Use `util.types` for Node.js 10+.
    var types = freeModule && freeModule.require && freeModule.require('util').types;

    if (types) {
      return types;
    }

    // Legacy `process.binding('util')` for Node.js < 10.
    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}());

module.exports = nodeUtil;

},{"./_freeGlobal":43}],73:[function(require,module,exports){
/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

module.exports = objectToString;

},{}],74:[function(require,module,exports){
/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

module.exports = overArg;

},{}],75:[function(require,module,exports){
var freeGlobal = require('./_freeGlobal');

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

module.exports = root;

},{"./_freeGlobal":43}],76:[function(require,module,exports){
var memoizeCapped = require('./_memoizeCapped');

/** Used to match property names within property paths. */
var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
var stringToPath = memoizeCapped(function(string) {
  var result = [];
  if (string.charCodeAt(0) === 46 /* . */) {
    result.push('');
  }
  string.replace(rePropName, function(match, number, quote, subString) {
    result.push(quote ? subString.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
});

module.exports = stringToPath;

},{"./_memoizeCapped":69}],77:[function(require,module,exports){
var isSymbol = require('./isSymbol');

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || isSymbol(value)) {
    return value;
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = toKey;

},{"./isSymbol":93}],78:[function(require,module,exports){
/** Used for built-in method references. */
var funcProto = Function.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

module.exports = toSource;

},{}],79:[function(require,module,exports){
/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

module.exports = eq;

},{}],80:[function(require,module,exports){
var baseGet = require('./_baseGet');

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined`, the `defaultValue` is returned in its place.
 *
 * @static
 * @memberOf _
 * @since 3.7.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

module.exports = get;

},{"./_baseGet":32}],81:[function(require,module,exports){
var baseIsArguments = require('./_baseIsArguments'),
    isObjectLike = require('./isObjectLike');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
    !propertyIsEnumerable.call(value, 'callee');
};

module.exports = isArguments;

},{"./_baseIsArguments":34,"./isObjectLike":90}],82:[function(require,module,exports){
/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = isArray;

},{}],83:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isLength = require('./isLength');

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

module.exports = isArrayLike;

},{"./isFunction":85,"./isLength":86}],84:[function(require,module,exports){
var root = require('./_root'),
    stubFalse = require('./stubFalse');

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

module.exports = isBuffer;

},{"./_root":75,"./stubFalse":97}],85:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isObject = require('./isObject');

/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

module.exports = isFunction;

},{"./_baseGetTag":33,"./isObject":89}],86:[function(require,module,exports){
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;

},{}],87:[function(require,module,exports){
/**
 * Checks if `value` is `null` or `undefined`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is nullish, else `false`.
 * @example
 *
 * _.isNil(null);
 * // => true
 *
 * _.isNil(void 0);
 * // => true
 *
 * _.isNil(NaN);
 * // => false
 */
function isNil(value) {
  return value == null;
}

module.exports = isNil;

},{}],88:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var numberTag = '[object Number]';

/**
 * Checks if `value` is classified as a `Number` primitive or object.
 *
 * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are
 * classified as numbers, use the `_.isFinite` method.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a number, else `false`.
 * @example
 *
 * _.isNumber(3);
 * // => true
 *
 * _.isNumber(Number.MIN_VALUE);
 * // => true
 *
 * _.isNumber(Infinity);
 * // => true
 *
 * _.isNumber('3');
 * // => false
 */
function isNumber(value) {
  return typeof value == 'number' ||
    (isObjectLike(value) && baseGetTag(value) == numberTag);
}

module.exports = isNumber;

},{"./_baseGetTag":33,"./isObjectLike":90}],89:[function(require,module,exports){
/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

module.exports = isObject;

},{}],90:[function(require,module,exports){
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],91:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    getPrototype = require('./_getPrototype'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor == 'function' && Ctor instanceof Ctor &&
    funcToString.call(Ctor) == objectCtorString;
}

module.exports = isPlainObject;

},{"./_baseGetTag":33,"./_getPrototype":46,"./isObjectLike":90}],92:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isArray = require('./isArray'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var stringTag = '[object String]';

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a string, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag);
}

module.exports = isString;

},{"./_baseGetTag":33,"./isArray":82,"./isObjectLike":90}],93:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && baseGetTag(value) == symbolTag);
}

module.exports = isSymbol;

},{"./_baseGetTag":33,"./isObjectLike":90}],94:[function(require,module,exports){
var baseIsTypedArray = require('./_baseIsTypedArray'),
    baseUnary = require('./_baseUnary'),
    nodeUtil = require('./_nodeUtil');

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

module.exports = isTypedArray;

},{"./_baseIsTypedArray":36,"./_baseUnary":40,"./_nodeUtil":72}],95:[function(require,module,exports){
var arrayLikeKeys = require('./_arrayLikeKeys'),
    baseKeys = require('./_baseKeys'),
    isArrayLike = require('./isArrayLike');

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

module.exports = keys;

},{"./_arrayLikeKeys":29,"./_baseKeys":37,"./isArrayLike":83}],96:[function(require,module,exports){
var MapCache = require('./_MapCache');

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `clear`, `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */
function memoize(func, resolver) {
  if (typeof func != 'function' || (resolver != null && typeof resolver != 'function')) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result) || cache;
    return result;
  };
  memoized.cache = new (memoize.Cache || MapCache);
  return memoized;
}

// Expose `MapCache`.
memoize.Cache = MapCache;

module.exports = memoize;

},{"./_MapCache":27}],97:[function(require,module,exports){
/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = stubFalse;

},{}],98:[function(require,module,exports){
var baseToString = require('./_baseToString');

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

module.exports = toString;

},{"./_baseToString":39}],99:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1,2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjaXRpZXMuanMiLCJsZWFkZXJib2FyZC5qcyIsIm5vZGVfbW9kdWxlcy9hYm9ydGNvbnRyb2xsZXItcG9seWZpbGwvZGlzdC9janMtcG9ueWZpbGwuanMiLCJub2RlX21vZHVsZXMvYWlydGFibGUvbGliL2Fib3J0LWNvbnRyb2xsZXIuanMiLCJub2RlX21vZHVsZXMvYWlydGFibGUvbGliL2FpcnRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL2FpcnRhYmxlL2xpYi9haXJ0YWJsZV9lcnJvci5qcyIsIm5vZGVfbW9kdWxlcy9haXJ0YWJsZS9saWIvYmFzZS5qcyIsIm5vZGVfbW9kdWxlcy9haXJ0YWJsZS9saWIvY2FsbGJhY2tfdG9fcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9haXJ0YWJsZS9saWIvZGVwcmVjYXRlLmpzIiwibm9kZV9tb2R1bGVzL2FpcnRhYmxlL2xpYi9leHBvbmVudGlhbF9iYWNrb2ZmX3dpdGhfaml0dGVyLmpzIiwibm9kZV9tb2R1bGVzL2FpcnRhYmxlL2xpYi9mZXRjaC5qcyIsIm5vZGVfbW9kdWxlcy9haXJ0YWJsZS9saWIvaGFzLmpzIiwibm9kZV9tb2R1bGVzL2FpcnRhYmxlL2xpYi9odHRwX2hlYWRlcnMuanMiLCJub2RlX21vZHVsZXMvYWlydGFibGUvbGliL2ludGVybmFsX2NvbmZpZy5qc29uIiwibm9kZV9tb2R1bGVzL2FpcnRhYmxlL2xpYi9vYmplY3RfdG9fcXVlcnlfcGFyYW1fc3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL2FpcnRhYmxlL2xpYi9wYWNrYWdlX3ZlcnNpb25fYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9haXJ0YWJsZS9saWIvcXVlcnkuanMiLCJub2RlX21vZHVsZXMvYWlydGFibGUvbGliL3F1ZXJ5X3BhcmFtcy5qcyIsIm5vZGVfbW9kdWxlcy9haXJ0YWJsZS9saWIvcmVjb3JkLmpzIiwibm9kZV9tb2R1bGVzL2FpcnRhYmxlL2xpYi9ydW5fYWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2FpcnRhYmxlL2xpYi90YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9haXJ0YWJsZS9saWIvdHlwZWNoZWNrLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX0hhc2guanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19MaXN0Q2FjaGUuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19NYXAuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19NYXBDYWNoZS5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX1N5bWJvbC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2FycmF5TGlrZUtleXMuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19hcnJheU1hcC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2Fzc29jSW5kZXhPZi5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2Jhc2VHZXQuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19iYXNlR2V0VGFnLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fYmFzZUlzQXJndW1lbnRzLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fYmFzZUlzTmF0aXZlLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fYmFzZUlzVHlwZWRBcnJheS5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2Jhc2VLZXlzLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fYmFzZVRpbWVzLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fYmFzZVRvU3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fYmFzZVVuYXJ5LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fY2FzdFBhdGguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19jb3JlSnNEYXRhLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fZnJlZUdsb2JhbC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2dldE1hcERhdGEuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19nZXROYXRpdmUuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19nZXRQcm90b3R5cGUuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19nZXRSYXdUYWcuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19nZXRWYWx1ZS5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2hhc2hDbGVhci5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2hhc2hEZWxldGUuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19oYXNoR2V0LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9faGFzaEhhcy5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2hhc2hTZXQuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19pc0luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9faXNLZXkuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19pc0tleWFibGUuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19pc01hc2tlZC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX2lzUHJvdG90eXBlLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fbGlzdENhY2hlQ2xlYXIuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19saXN0Q2FjaGVEZWxldGUuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19saXN0Q2FjaGVHZXQuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19saXN0Q2FjaGVIYXMuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19saXN0Q2FjaGVTZXQuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19tYXBDYWNoZUNsZWFyLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fbWFwQ2FjaGVEZWxldGUuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19tYXBDYWNoZUdldC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX21hcENhY2hlSGFzLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fbWFwQ2FjaGVTZXQuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19tZW1vaXplQ2FwcGVkLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fbmF0aXZlQ3JlYXRlLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fbmF0aXZlS2V5cy5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX25vZGVVdGlsLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fb2JqZWN0VG9TdHJpbmcuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL19vdmVyQXJnLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fcm9vdC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX3N0cmluZ1RvUGF0aC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvX3RvS2V5LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9fdG9Tb3VyY2UuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2VxLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9nZXQuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2lzQXJndW1lbnRzLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pc0FycmF5LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pc0FycmF5TGlrZS5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaXNCdWZmZXIuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2lzRnVuY3Rpb24uanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2lzTGVuZ3RoLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pc05pbC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaXNOdW1iZXIuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2lzT2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pc09iamVjdExpa2UuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2lzUGxhaW5PYmplY3QuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL2lzU3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9pc1N5bWJvbC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gvaXNUeXBlZEFycmF5LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9rZXlzLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9tZW1vaXplLmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC9zdHViRmFsc2UuanMiLCJub2RlX21vZHVsZXMvbG9kYXNoL3RvU3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25lQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDcERBO0FBQ0E7QUFDQTs7OztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIjsoZnVuY3Rpb24gKCkge1xyXG4gIGlmICghZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JobmEtZGF0YS1hcHAnKSkgcmV0dXJuXHJcblxyXG4gIGNvbnN0IEFpcnRhYmxlID0gcmVxdWlyZSgnYWlydGFibGUnKVxyXG4gIGNvbnN0IGJhc2UgPSBuZXcgQWlydGFibGUoeyBhcGlLZXk6ICdrZXlZNlU5c0l0STl2M0hHMScgfSkuYmFzZShcclxuICAgICdhcHBSRDJ6M1ZYczc4aXE4MCdcclxuICApXHJcblxyXG4gIC8vIGdsb2JhbCBvYmplY3QgaG9sZGluZyBhbGwgcmVjb3Jkcywga2V5ZWQgYnkgYWlydGFibGUgaWRcclxuICBjb25zdCBjaXRpZXMgPSB7fVxyXG5cclxuICAvLyBhbGxvd3MgZm9yIHBhcmVudCB0byBzZXQgY3VzdG9tIGRpc3BsYXkgb2YgZmllbGQgYXMgd2VsbCBhc1xyXG4gIC8vIGF1dG9tYXRpY2FsbHkgaGFuZGxpbmcgZmFsbGJhY2sgXCJtaXNzaW5nIGluZm9cIiBjYWxsIHRvIGFjdGlvblxyXG4gIFZ1ZS5jb21wb25lbnQoJ2ZpZWxkJywge1xyXG4gICAgcHJvcHM6IFsndGl0bGUnLCAndmFsdWUnXSxcclxuICAgIHRlbXBsYXRlOiBgPGRpdj5cclxuICAgICAge3sgdGl0bGUgfX06XHJcbiAgICAgIDxzbG90IHYtaWY9XCJ2YWx1ZVwiPnt7IHZhbHVlIH19PC9zbG90PlxyXG4gICAgICA8YSBocmVmPVwiaHR0cHM6Ly9haXJ0YWJsZS5jb20vc2hyOWZpcExMajFXVEhLdTdcIiB0YXJnZXQ9XCJfYmxhbmtcIiB2LWVsc2U+TWlzc2luZyBkYXRhLCB2b2x1bnRlZXIgdG8gaGVscCE8L2E+XHJcbiAgICA8L2Rpdj5gLFxyXG4gIH0pXHJcblxyXG4gIGNvbnN0IGRhdGEgPSB7XHJcbiAgICBjaXR5OiBudWxsLFxyXG4gICAgbW9kYWxWaXNpYmxlOiBmYWxzZSxcclxuICAgIG1vZGFsRGF0YTogbnVsbCxcclxuICAgIGNoYXJ0UmVuZGVyZWQ6IGZhbHNlLFxyXG4gIH1cclxuICBjb25zdCBhcHAgPSBuZXcgVnVlKHtcclxuICAgIGVsOiAnI3JobmEtZGF0YS1hcHAnLFxyXG4gICAgZGF0YTogZGF0YSxcclxuICAgIGNvbXB1dGVkOiB7XHJcbiAgICAgIHByb2dyZXNzQ29sb3I6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5jaXR5LnByb2dyZXNzIDwgNTApIHtcclxuICAgICAgICAgIHJldHVybiAncmVkJ1xyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5jaXR5LnByb2dyZXNzIDwgOTApIHtcclxuICAgICAgICAgIHJldHVybiAnb3JhbmdlJ1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gJ2dyZWVuJ1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICB1cGRhdGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIGlmICghdGhpcy5jaXR5KSByZXR1cm5cclxuXHJcbiAgICAgIGlmICghdGhpcy5jaGFydFJlbmRlcmVkKSB7XHJcbiAgICAgICAgcmVuZGVyUkhOQUNoYXJ0KHRoaXMuY2l0eSlcclxuICAgICAgICB0aGlzLmNoYXJ0UmVuZGVyZWQgPSB0cnVlXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICh0aGlzLmNpdHkuY2FsZW5kYXJJZHMpIHtcclxuICAgICAgICBQcm9taXNlLmFsbChcclxuICAgICAgICAgIHRoaXMuY2l0eS5jYWxlbmRhcklkcy5tYXAoKGNhbGVuZGFySWQpID0+XHJcbiAgICAgICAgICAgIGJhc2UoJ0NhbGVuZGFyJykuZmluZChjYWxlbmRhcklkKVxyXG4gICAgICAgICAgKVxyXG4gICAgICAgICkudGhlbigoY2FsZW5kYXJzKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLmNpdHkuY2FsZW5kYXJzID0gY2FsZW5kYXJzLm1hcChub3JtYWxpemVDYWxlbmRhclJlY29yZClcclxuICAgICAgICAgIC8vIGRlYnVnZ2VyXHJcbiAgICAgICAgICBkZWxldGUgdGhpcy5jaXR5LmNhbGVuZGFySWRzXHJcbiAgICAgICAgfSlcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMuY2l0eS5tZWV0aW5nUmVwb3J0SURzKSB7XHJcbiAgICAgICAgUHJvbWlzZS5hbGwoXHJcbiAgICAgICAgICB0aGlzLmNpdHkubWVldGluZ1JlcG9ydElEcy5tYXAoKG1lZXRpbmdSZXBvcnRJRCkgPT5cclxuICAgICAgICAgICAgYmFzZSgnUmVwb3J0cycpLmZpbmQobWVldGluZ1JlcG9ydElEKVxyXG4gICAgICAgICAgKVxyXG4gICAgICAgICkudGhlbigocmVwb3J0cykgPT4ge1xyXG4gICAgICAgICAgdGhpcy5jaXR5Lm1lZXRpbmdSZXBvcnRzID0gcmVwb3J0cy5tYXAobm9ybWFsaXplUmVwb3J0UmVjb3JkKVxyXG4gICAgICAgICAgZGVsZXRlIHRoaXMuY2l0eS5tZWV0aW5nUmVwb3J0SURzXHJcbiAgICAgICAgfSlcclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIG1ldGhvZHM6IHtcclxuICAgICAgb3Blbk1vZGFsKGRhdGEpIHtcclxuICAgICAgICB0aGlzLm1vZGFsRGF0YSA9IGRhdGFcclxuICAgICAgICB0aGlzLm1vZGFsVmlzaWJsZSA9IHRydWVcclxuICAgICAgfSxcclxuICAgICAgY2xvc2VNb2RhbCgpIHtcclxuICAgICAgICB0aGlzLm1vZGFsVmlzaWJsZSA9IGZhbHNlXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgZmlsdGVyczoge1xyXG4gICAgICB0cnVuY2F0ZTogZnVuY3Rpb24gKHRleHQpIHtcclxuICAgICAgICBpZiAoIXRleHQpIHJldHVybiAnJ1xyXG4gICAgICAgIHRleHQgPSB0ZXh0LnRvU3RyaW5nKClcclxuICAgICAgICBpZiAodGV4dC5sZW5ndGggPiAyMDApIHJldHVybiB0ZXh0LnNsaWNlKDAsIDE5NykgKyAnLi4uJ1xyXG4gICAgICAgIHJldHVybiB0ZXh0XHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0pXHJcblxyXG4gIGZ1bmN0aW9uIHJlbmRlclJITkFDaGFydChjaXR5KSB7XHJcbiAgICBjb25zdCBjaGFydHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmhuYS1jaGFydHMnKVxyXG4gICAgY2hhcnRzLmlubmVySFRNTCA9ICcnXHJcbiAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKVxyXG4gICAgY2FudmFzLmhlaWdodCA9IDIwMFxyXG4gICAgY2FudmFzLndpZHRoID0gNDAwXHJcbiAgICBjaGFydHMuYXBwZW5kQ2hpbGQoY2FudmFzKVxyXG5cclxuICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpXHJcblxyXG4gICAgY29uc3QgY2hhcnQgPSBuZXcgQ2hhcnQoY3R4LCB7XHJcbiAgICAgIHR5cGU6ICdwaWUnLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgbGFiZWxzOiBbXHJcbiAgICAgICAgICAnVmVyeSBMb3cgSW5jb21lJyxcclxuICAgICAgICAgICdMb3cgSW5jb21lJyxcclxuICAgICAgICAgICdNb2RlcmF0ZSBJbmNvbWUnLFxyXG4gICAgICAgICAgJ0Fib3ZlIE1vZGVyYXRlIEluY29tZScsXHJcbiAgICAgICAgXSxcclxuICAgICAgICBkYXRhc2V0czogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBsYWJlbDogJzZ0aCBDeWNsZSBSSE5BJyxcclxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBbJyMxZTY5N2EnLCAnIzdhMDAyNycsICcjZGI2NDAwJywgJyNmOGE2MmInXSxcclxuICAgICAgICAgICAgZGF0YTogW2NpdHkudmxpLCBjaXR5LmxpLCBjaXR5Lm1pLCBjaXR5LmFtaV0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICBsZWdlbmQ6IHsgZGlzcGxheTogdHJ1ZSB9LFxyXG4gICAgICAgIHRpdGxlOiB7XHJcbiAgICAgICAgICBkaXNwbGF5OiB0cnVlLFxyXG4gICAgICAgICAgZm9udFNpemU6IDE2LFxyXG4gICAgICAgICAgZm9udENvbG9yOiAnIzAwMCcsXHJcbiAgICAgICAgICB0ZXh0OiAnNnRoIEN5Y2xlIFJITkEgQWxsb2NhdGlvbjogQnkgSW5jb21lJyxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIHNlbGVjdGlvbkNoYW5nZWQoaWQpIHtcclxuICAgIGRhdGEuY2l0eSA9IGNpdGllc1tpZF1cclxuICAgIGRhdGEuY2hhcnRSZW5kZXJlZCA9IGZhbHNlXHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmhuYS1kYXRhLWFwcCcpLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snXHJcbiAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9IGlkXHJcbiAgfVxyXG5cclxuICAvLyBQb3B1bGF0ZXMgdGhlIHNlbGVjdCBkcm9wZG93biB3aXRoIGFsbCBjaXRpZXMgZnJvbSB2YWx1ZXMuXHJcbiAgZnVuY3Rpb24gcG9wdWxhdGVTZWxlY3RvcldpdGhDaXRpZXMoY2l0aWVzKSB7XHJcbiAgICBjb25zdCBzZWxlY3RvciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyaG5hLXNlbGVjdG9yJylcclxuICAgIGxldCBjaXRpZXNfYXJyID0gW11cclxuICAgIGZvciAoaWQgaW4gY2l0aWVzKSB7XHJcbiAgICAgIGlmIChjaXRpZXNbaWRdLmp1cmlzZGljdGlvbilcclxuICAgICAgICBjaXRpZXNfYXJyLnB1c2goW2NpdGllc1tpZF0uanVyaXNkaWN0aW9uLCBpZF0pXHJcbiAgICB9XHJcblxyXG4gICAgY2l0aWVzX2Fyci5zb3J0KClcclxuXHJcbiAgICBmb3IgKFtqdXJpc2RpY3Rpb24sIGlkXSBvZiBjaXRpZXNfYXJyKSB7XHJcbiAgICAgIGNvbnN0IG9wdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpXHJcbiAgICAgIG9wdC5pbm5lclRleHQgPSBqdXJpc2RpY3Rpb25cclxuICAgICAgb3B0LnZhbHVlID0gaWRcclxuICAgICAgc2VsZWN0b3IuYXBwZW5kQ2hpbGQob3B0KVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gbm9ybWFsaXplQ2l0eVJlY29yZChyZWNvcmQpIHtcclxuICAgIGNvbnN0IGZpZWxkcyA9IHtcclxuICAgICAgYW1pOiAnQU1JJyxcclxuICAgICAgY291bmNpbDogJ0NPR19kaXNwbGF5JyxcclxuICAgICAgY291bnRWb2x1bnRlZXJzOiAnIyBWb2x1bnRlZXJzJyxcclxuICAgICAgY291bnR5OiAnQ291bnR5X2Rpc3BsYXknLFxyXG4gICAgICBkZW5zaXR5OiAnRGVuc2l0eScsXHJcbiAgICAgIGR1ZURhdGU6ICdEdWUgRGF0ZScsXHJcbiAgICAgIGZpZnRoRWxlbWVudERyYWZ0VXJsOiAnNXRoIEN5Y2xlIEhvdXNpbmcgRWxlbWVudCcsXHJcbiAgICAgIEhFV2VicGFnZVVybDogJ0NpdHkgSEUgV2VicGFnZScsXHJcbiAgICAgIEhFU3VydmV5VXJsOiAnSG91c2luZyBTdXJ2ZXknLFxyXG4gICAgICBIRVN0YXR1czogJ0hFIENvbXBsaWFuY2UnLFxyXG4gICAgICBqdXJpc2RpY3Rpb246ICdKdXJpc2RpY3Rpb24nLFxyXG4gICAgICBsaTogJ0xJJyxcclxuICAgICAgbWk6ICdNSScsXHJcbiAgICAgIG1lZGlhbkluY29tZTogJ01lZGlhbiBJbmNvbWUnLFxyXG4gICAgICBwb3B1bGF0aW9uOiAnUG9wdWxhdGlvbiAoMjAyMCknLFxyXG4gICAgICBwcm9ncmVzczogJzV0aCBDeWNsZSBQcm9ncmVzcyAlJyxcclxuICAgICAgcmhuYTU6ICc1dGggQ3ljbGUgUkhOQSAoVG90YWwpJyxcclxuICAgICAgcmhuYTY6ICc2dGggQ3ljbGUgUkhOQScsXHJcbiAgICAgIHNpeHRoRWxlbWVudERyYWZ0VXJsOiAnNnRoIEN5Y2xlIERyYWZ0JyxcclxuICAgICAgdmxpOiAnVkxJJyxcclxuICAgICAgbWVldGluZ1JlcG9ydHM6ICdNdGdSZXBvcnRfZGlzcGxheScsXHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChrZXkgaW4gZmllbGRzKSB7XHJcbiAgICAgIGxldCB2YWx1ZSA9IHJlY29yZC5maWVsZHNbZmllbGRzW2tleV1dXHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT0gMSkge1xyXG4gICAgICAgIHZhbHVlID0gdmFsdWVbMF1cclxuICAgICAgfVxyXG4gICAgICBmaWVsZHNba2V5XSA9IHZhbHVlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGZpZWxkcy5kdWVEYXRlKSB7XHJcbiAgICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKVxyXG4gICAgICBjb25zdCBvbmVfZGF5ID0gMTAwMCAqIDYwICogNjAgKiAyNFxyXG4gICAgICBmaWVsZHMuZHVlRGF0ZSA9IG5ldyBEYXRlKGZpZWxkcy5kdWVEYXRlKVxyXG4gICAgICBmaWVsZHMuZHVlRGF5c0xlZnQgPSBNYXRoLmZsb29yKFxyXG4gICAgICAgIChmaWVsZHMuZHVlRGF0ZS5nZXRUaW1lKCkgLSB0b2RheS5nZXRUaW1lKCkpIC8gb25lX2RheVxyXG4gICAgICApXHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoIChmaWVsZHMucHJvZ3Jlc3MpIHtcclxuICAgICAgY2FzZSAnJzpcclxuICAgICAgY2FzZSAnTmFOJzpcclxuICAgICAgY2FzZSAnMCc6XHJcbiAgICAgIGNhc2UgJzAlJzpcclxuICAgICAgY2FzZSAnMC4wJSc6XHJcbiAgICAgIGNhc2UgdW5kZWZpbmVkOlxyXG4gICAgICAgIGZpZWxkcy5wcm9ncmVzcyA9IG51bGxcclxuICAgICAgICBicmVha1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIGZpZWxkcy5wcm9ncmVzcyA9IE1hdGgucm91bmQocGFyc2VGbG9hdChmaWVsZHMucHJvZ3Jlc3MpICogMTAwKVxyXG4gICAgfVxyXG5cclxuICAgIGZpZWxkcy5jYWxlbmRhcklkcyA9IHJlY29yZC5maWVsZHMuQ2FsZW5kYXJcclxuICAgIGZpZWxkcy5jYWxlbmRhcnMgPSBbXVxyXG5cclxuICAgIGZpZWxkcy5tZWV0aW5nUmVwb3J0SURzID0gcmVjb3JkLmZpZWxkc1snTXRnIFJlcG9ydHMnXVxyXG4gICAgZmllbGRzLm1lZXRpbmdSZXBvcnRzID0gW11cclxuXHJcbiAgICBmaWVsZHMuaWQgPSByZWNvcmQuaWRcclxuICAgIHJldHVybiBmaWVsZHNcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZUNhbGVuZGFyUmVjb3JkKHJlY29yZCkge1xyXG4gICAgY29uc3QgZmllbGRzID0ge1xyXG4gICAgICBkYXRlOiAnRGF0ZSAmIFRpbWUnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1Nob3J0IERlc2NyaXB0aW9uJyxcclxuICAgICAgbGluazogJ1dlYnNpdGUnLFxyXG4gICAgfVxyXG5cclxuICAgIGZvciAoa2V5IGluIGZpZWxkcykge1xyXG4gICAgICBsZXQgdmFsdWUgPSByZWNvcmQuZmllbGRzW2ZpZWxkc1trZXldXVxyXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09IDEpIHtcclxuICAgICAgICB2YWx1ZSA9IHZhbHVlWzBdXHJcbiAgICAgIH1cclxuICAgICAgZmllbGRzW2tleV0gPSB2YWx1ZVxyXG4gICAgfVxyXG5cclxuICAgIGZpZWxkcy5kYXRlID0gbmV3IERhdGUoZmllbGRzLmRhdGUpXHJcblxyXG4gICAgZmllbGRzLmlkID0gcmVjb3JkLmlkXHJcbiAgICByZXR1cm4gZmllbGRzXHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBub3JtYWxpemVSZXBvcnRSZWNvcmQocmVjb3JkKSB7XHJcbiAgICBjb25zdCBmaWVsZHMgPSB7XHJcbiAgICAgIHJlcG9ydDogJ1JlcG9ydCcsXHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChrZXkgaW4gZmllbGRzKSB7XHJcbiAgICAgIGxldCB2YWx1ZSA9IHJlY29yZC5maWVsZHNbZmllbGRzW2tleV1dXHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT0gMSkge1xyXG4gICAgICAgIHZhbHVlID0gdmFsdWVbMF1cclxuICAgICAgfVxyXG4gICAgICBmaWVsZHNba2V5XSA9IHZhbHVlXHJcbiAgICB9XHJcblxyXG4gICAgZmllbGRzLmlkID0gcmVjb3JkLmlkXHJcbiAgICByZXR1cm4gZmllbGRzXHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBwb3B1bGF0ZUNpdGllc0Zyb21BaXJ0YWJsZSgpIHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIGJhc2UoJ0NpdGllcycpXHJcbiAgICAgICAgLnNlbGVjdCh7IHZpZXc6ICdDaXR5IERhdGEnIH0pXHJcbiAgICAgICAgLmVhY2hQYWdlKFxyXG4gICAgICAgICAgZnVuY3Rpb24gcGFnZShyZWNvcmRzLCBmZXRjaE5leHRQYWdlKSB7XHJcbiAgICAgICAgICAgIHJlY29yZHMuZm9yRWFjaChcclxuICAgICAgICAgICAgICAocmVjb3JkKSA9PiAoY2l0aWVzW3JlY29yZC5pZF0gPSBub3JtYWxpemVDaXR5UmVjb3JkKHJlY29yZCkpXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICAgZmV0Y2hOZXh0UGFnZSgpXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgZnVuY3Rpb24gZG9uZShlcnIpIHtcclxuICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKVxyXG4gICAgICAgICAgICAgIHJlamVjdChlcnIpXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICApXHJcbiAgICB9KVxyXG4gIH1cclxuXHJcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyaG5hLXNlbGVjdG9yJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGUpID0+IHtcclxuICAgICAgc2VsZWN0aW9uQ2hhbmdlZChlLnRhcmdldC52YWx1ZSlcclxuICAgIH0pXHJcblxyXG4gICAgaWYgKHdpbmRvdy5sb2NhdGlvbi5oYXNoLmxlbmd0aCA+IDEpIHtcclxuICAgICAgY29uc3QgaGFzaCA9IGRlY29kZVVSSShkb2N1bWVudC5sb2NhdGlvbi5oYXNoLnN1YnN0cmluZygxKSlcclxuICAgICAgYmFzZSgnQ2l0aWVzJylcclxuICAgICAgICAuZmluZChoYXNoKVxyXG4gICAgICAgIC50aGVuKChyZWNvcmQpID0+IHtcclxuICAgICAgICAgIGNpdGllc1tyZWNvcmQuaWRdID0gbm9ybWFsaXplQ2l0eVJlY29yZChyZWNvcmQpXHJcbiAgICAgICAgICBzZWxlY3Rpb25DaGFuZ2VkKGhhc2gpXHJcbiAgICAgICAgICBwb3B1bGF0ZUNpdGllc0Zyb21BaXJ0YWJsZSgpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICBwb3B1bGF0ZVNlbGVjdG9yV2l0aENpdGllcyhjaXRpZXMpXHJcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyaG5hLXNlbGVjdG9yJykudmFsdWUgPSBoYXNoXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIH0pXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBwb3B1bGF0ZUNpdGllc0Zyb21BaXJ0YWJsZSgpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgIHBvcHVsYXRlU2VsZWN0b3JXaXRoQ2l0aWVzKGNpdGllcylcclxuICAgICAgfSlcclxuICAgIH1cclxuICB9KVxyXG59KSgpXHJcbiIsImRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBmdW5jdGlvbiAoKSB7XHJcbiAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdsaXN0X190YWJsZScpKSByZXR1cm5cclxuXHJcbiAgY29uc3QgQWlydGFibGUgPSByZXF1aXJlKCdhaXJ0YWJsZScpXHJcbiAgY29uc3QgYmFzZSA9IG5ldyBBaXJ0YWJsZSh7IGFwaUtleTogJ2tleVk2VTlzSXRJOXYzSEcxJyB9KS5iYXNlKFxyXG4gICAgJ2FwcFJEMnozVlhzNzhpcTgwJ1xyXG4gIClcclxuXHJcbiAgZnVuY3Rpb24gZ2V0VG9wVm9sdW50ZWVycygpIHtcclxuICAgIGNvbnN0IGZpZWxkcyA9IHtcclxuICAgICAgdG90YWw6ICdUb3RhbCBzY29yZScsXHJcbiAgICAgIGNhbGVuZGFyOiAnIyBDYWxlbmRhciBFbnRyaWVzJyxcclxuICAgICAgaG9tZXdvcms6ICcjIEhvbWV3b3JrIEVudHJpZXMnLFxyXG4gICAgICBtZWV0aW5nOiAnIyBNZWV0aW5nIFJlcG9ydHMnLFxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHZvbHVudGVlcl9ncm91cHMgPSBbXVxyXG4gICAgZm9yIChjb25zdCBmaWVsZCBpbiBmaWVsZHMpIHtcclxuICAgICAgdm9sdW50ZWVyX2dyb3Vwcy5wdXNoKGdldFRvcFZvbHVudGVlcnNCeUZpZWxkKGZpZWxkc1tmaWVsZF0pKVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHZvbHVudGVlcl9ncm91cHMpLnRoZW4oKGdyb3VwcykgPT4ge1xyXG4gICAgICBjb25zdCBrZXllZF9ncm91cHMgPSB7fVxyXG4gICAgICBsZXQgaSA9IDBcclxuICAgICAgZm9yIChjb25zdCBmaWVsZCBpbiBmaWVsZHMpIHtcclxuICAgICAgICBrZXllZF9ncm91cHNbZmllbGRdID0gZ3JvdXBzW2ldXHJcbiAgICAgICAgaSsrXHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGtleWVkX2dyb3Vwc1xyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIGdldFRvcFZvbHVudGVlcnNCeUZpZWxkKGZpZWxkKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBiYXNlKCdWb2x1bnRlZXJzJylcclxuICAgICAgICAuc2VsZWN0KHtcclxuICAgICAgICAgIHZpZXc6ICdJbmRpdmlkdWFsIExlYWRlcmJvYXJkJyxcclxuICAgICAgICAgIG1heFJlY29yZHM6IDUsXHJcbiAgICAgICAgICBzb3J0OiBbeyBmaWVsZDogZmllbGQsIGRpcmVjdGlvbjogJ2Rlc2MnIH1dLFxyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLmZpcnN0UGFnZShmdW5jdGlvbiAoZXJyLCByZWNvcmRzKSB7XHJcbiAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKVxyXG4gICAgICAgICAgICByZWplY3QoZXJyKVxyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShcclxuICAgICAgICAgICAgICByZWNvcmRzLm1hcCgocmVjb3JkKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICBuYW1lOiByZWNvcmQuZmllbGRzWydGdWxsIE5hbWUnXSxcclxuICAgICAgICAgICAgICAgICAgbG9jYXRpb246IHJlY29yZC5maWVsZHNbJ0hvbWV0b3duJ10sXHJcbiAgICAgICAgICAgICAgICAgIHNjb3JlOiByZWNvcmQuZmllbGRzW2ZpZWxkXSxcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICApXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBnZXRUb3BWb2x1bnRlZXJzKCkudGhlbigodm9sdW50ZWVyX2dyb3VwcykgPT4ge1xyXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdsaXN0X190YWJsZScpKSB7XHJcbiAgICAgIG5ldyBWdWUoe1xyXG4gICAgICAgIGVsOiB0YWJsZSxcclxuICAgICAgICBkYXRhOiB2b2x1bnRlZXJfZ3JvdXBzLFxyXG4gICAgICB9KVxyXG4gICAgfVxyXG4gIH0pXHJcbn0pXHJcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3Rvcikge1xuICBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb25cIik7XG4gIH1cbn1cblxuZnVuY3Rpb24gX2RlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTtcbiAgICBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7XG4gICAgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlO1xuICAgIGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVDbGFzcyhDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHtcbiAgaWYgKHByb3RvUHJvcHMpIF9kZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7XG4gIGlmIChzdGF0aWNQcm9wcykgX2RlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTtcbiAgcmV0dXJuIENvbnN0cnVjdG9yO1xufVxuXG5mdW5jdGlvbiBfaW5oZXJpdHMoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIHtcbiAgaWYgKHR5cGVvZiBzdXBlckNsYXNzICE9PSBcImZ1bmN0aW9uXCIgJiYgc3VwZXJDbGFzcyAhPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvblwiKTtcbiAgfVxuXG4gIHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICB2YWx1ZTogc3ViQ2xhc3MsXG4gICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG4gIGlmIChzdXBlckNsYXNzKSBfc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpO1xufVxuXG5mdW5jdGlvbiBfZ2V0UHJvdG90eXBlT2Yobykge1xuICBfZ2V0UHJvdG90eXBlT2YgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgPyBPYmplY3QuZ2V0UHJvdG90eXBlT2YgOiBmdW5jdGlvbiBfZ2V0UHJvdG90eXBlT2Yobykge1xuICAgIHJldHVybiBvLl9fcHJvdG9fXyB8fCBPYmplY3QuZ2V0UHJvdG90eXBlT2Yobyk7XG4gIH07XG4gIHJldHVybiBfZ2V0UHJvdG90eXBlT2Yobyk7XG59XG5cbmZ1bmN0aW9uIF9zZXRQcm90b3R5cGVPZihvLCBwKSB7XG4gIF9zZXRQcm90b3R5cGVPZiA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fCBmdW5jdGlvbiBfc2V0UHJvdG90eXBlT2YobywgcCkge1xuICAgIG8uX19wcm90b19fID0gcDtcbiAgICByZXR1cm4gbztcbiAgfTtcblxuICByZXR1cm4gX3NldFByb3RvdHlwZU9mKG8sIHApO1xufVxuXG5mdW5jdGlvbiBfaXNOYXRpdmVSZWZsZWN0Q29uc3RydWN0KCkge1xuICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwidW5kZWZpbmVkXCIgfHwgIVJlZmxlY3QuY29uc3RydWN0KSByZXR1cm4gZmFsc2U7XG4gIGlmIChSZWZsZWN0LmNvbnN0cnVjdC5zaGFtKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgUHJveHkgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHRydWU7XG5cbiAgdHJ5IHtcbiAgICBCb29sZWFuLnByb3RvdHlwZS52YWx1ZU9mLmNhbGwoUmVmbGVjdC5jb25zdHJ1Y3QoQm9vbGVhbiwgW10sIGZ1bmN0aW9uICgpIHt9KSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gX2Fzc2VydFRoaXNJbml0aWFsaXplZChzZWxmKSB7XG4gIGlmIChzZWxmID09PSB2b2lkIDApIHtcbiAgICB0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoXCJ0aGlzIGhhc24ndCBiZWVuIGluaXRpYWxpc2VkIC0gc3VwZXIoKSBoYXNuJ3QgYmVlbiBjYWxsZWRcIik7XG4gIH1cblxuICByZXR1cm4gc2VsZjtcbn1cblxuZnVuY3Rpb24gX3Bvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4oc2VsZiwgY2FsbCkge1xuICBpZiAoY2FsbCAmJiAodHlwZW9mIGNhbGwgPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIGNhbGwgPT09IFwiZnVuY3Rpb25cIikpIHtcbiAgICByZXR1cm4gY2FsbDtcbiAgfVxuXG4gIHJldHVybiBfYXNzZXJ0VGhpc0luaXRpYWxpemVkKHNlbGYpO1xufVxuXG5mdW5jdGlvbiBfY3JlYXRlU3VwZXIoRGVyaXZlZCkge1xuICB2YXIgaGFzTmF0aXZlUmVmbGVjdENvbnN0cnVjdCA9IF9pc05hdGl2ZVJlZmxlY3RDb25zdHJ1Y3QoKTtcblxuICByZXR1cm4gZnVuY3Rpb24gX2NyZWF0ZVN1cGVySW50ZXJuYWwoKSB7XG4gICAgdmFyIFN1cGVyID0gX2dldFByb3RvdHlwZU9mKERlcml2ZWQpLFxuICAgICAgICByZXN1bHQ7XG5cbiAgICBpZiAoaGFzTmF0aXZlUmVmbGVjdENvbnN0cnVjdCkge1xuICAgICAgdmFyIE5ld1RhcmdldCA9IF9nZXRQcm90b3R5cGVPZih0aGlzKS5jb25zdHJ1Y3RvcjtcblxuICAgICAgcmVzdWx0ID0gUmVmbGVjdC5jb25zdHJ1Y3QoU3VwZXIsIGFyZ3VtZW50cywgTmV3VGFyZ2V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gU3VwZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gX3Bvc3NpYmxlQ29uc3RydWN0b3JSZXR1cm4odGhpcywgcmVzdWx0KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gX3N1cGVyUHJvcEJhc2Uob2JqZWN0LCBwcm9wZXJ0eSkge1xuICB3aGlsZSAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIHByb3BlcnR5KSkge1xuICAgIG9iamVjdCA9IF9nZXRQcm90b3R5cGVPZihvYmplY3QpO1xuICAgIGlmIChvYmplY3QgPT09IG51bGwpIGJyZWFrO1xuICB9XG5cbiAgcmV0dXJuIG9iamVjdDtcbn1cblxuZnVuY3Rpb24gX2dldCh0YXJnZXQsIHByb3BlcnR5LCByZWNlaXZlcikge1xuICBpZiAodHlwZW9mIFJlZmxlY3QgIT09IFwidW5kZWZpbmVkXCIgJiYgUmVmbGVjdC5nZXQpIHtcbiAgICBfZ2V0ID0gUmVmbGVjdC5nZXQ7XG4gIH0gZWxzZSB7XG4gICAgX2dldCA9IGZ1bmN0aW9uIF9nZXQodGFyZ2V0LCBwcm9wZXJ0eSwgcmVjZWl2ZXIpIHtcbiAgICAgIHZhciBiYXNlID0gX3N1cGVyUHJvcEJhc2UodGFyZ2V0LCBwcm9wZXJ0eSk7XG5cbiAgICAgIGlmICghYmFzZSkgcmV0dXJuO1xuICAgICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGJhc2UsIHByb3BlcnR5KTtcblxuICAgICAgaWYgKGRlc2MuZ2V0KSB7XG4gICAgICAgIHJldHVybiBkZXNjLmdldC5jYWxsKHJlY2VpdmVyKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRlc2MudmFsdWU7XG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBfZ2V0KHRhcmdldCwgcHJvcGVydHksIHJlY2VpdmVyIHx8IHRhcmdldCk7XG59XG5cbnZhciBFbWl0dGVyID0gLyojX19QVVJFX18qL2Z1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gRW1pdHRlcigpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgRW1pdHRlcik7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2xpc3RlbmVycycsIHtcbiAgICAgIHZhbHVlOiB7fSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoRW1pdHRlciwgW3tcbiAgICBrZXk6IFwiYWRkRXZlbnRMaXN0ZW5lclwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgICBpZiAoISh0eXBlIGluIHRoaXMubGlzdGVuZXJzKSkge1xuICAgICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXS5wdXNoKHtcbiAgICAgICAgY2FsbGJhY2s6IGNhbGxiYWNrLFxuICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICB9KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwicmVtb3ZlRXZlbnRMaXN0ZW5lclwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAoISh0eXBlIGluIHRoaXMubGlzdGVuZXJzKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciBzdGFjayA9IHRoaXMubGlzdGVuZXJzW3R5cGVdO1xuXG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHN0YWNrLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBpZiAoc3RhY2tbaV0uY2FsbGJhY2sgPT09IGNhbGxiYWNrKSB7XG4gICAgICAgICAgc3RhY2suc3BsaWNlKGksIDEpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogXCJkaXNwYXRjaEV2ZW50XCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGRpc3BhdGNoRXZlbnQoZXZlbnQpIHtcbiAgICAgIGlmICghKGV2ZW50LnR5cGUgaW4gdGhpcy5saXN0ZW5lcnMpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIHN0YWNrID0gdGhpcy5saXN0ZW5lcnNbZXZlbnQudHlwZV07XG4gICAgICB2YXIgc3RhY2tUb0NhbGwgPSBzdGFjay5zbGljZSgpO1xuXG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHN0YWNrVG9DYWxsLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIgbGlzdGVuZXIgPSBzdGFja1RvQ2FsbFtpXTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGxpc3RlbmVyLmNhbGxiYWNrLmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxpc3RlbmVyLm9wdGlvbnMgJiYgbGlzdGVuZXIub3B0aW9ucy5vbmNlKSB7XG4gICAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LnR5cGUsIGxpc3RlbmVyLmNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gIWV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQ7XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIEVtaXR0ZXI7XG59KCk7XG5cbnZhciBBYm9ydFNpZ25hbCA9IC8qI19fUFVSRV9fKi9mdW5jdGlvbiAoX0VtaXR0ZXIpIHtcbiAgX2luaGVyaXRzKEFib3J0U2lnbmFsLCBfRW1pdHRlcik7XG5cbiAgdmFyIF9zdXBlciA9IF9jcmVhdGVTdXBlcihBYm9ydFNpZ25hbCk7XG5cbiAgZnVuY3Rpb24gQWJvcnRTaWduYWwoKSB7XG4gICAgdmFyIF90aGlzO1xuXG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEFib3J0U2lnbmFsKTtcblxuICAgIF90aGlzID0gX3N1cGVyLmNhbGwodGhpcyk7IC8vIFNvbWUgdmVyc2lvbnMgb2YgYmFiZWwgZG9lcyBub3QgdHJhbnNwaWxlIHN1cGVyKCkgY29ycmVjdGx5IGZvciBJRSA8PSAxMCwgaWYgdGhlIHBhcmVudFxuICAgIC8vIGNvbnN0cnVjdG9yIGhhcyBmYWlsZWQgdG8gcnVuLCB0aGVuIFwidGhpcy5saXN0ZW5lcnNcIiB3aWxsIHN0aWxsIGJlIHVuZGVmaW5lZCBhbmQgdGhlbiB3ZSBjYWxsXG4gICAgLy8gdGhlIHBhcmVudCBjb25zdHJ1Y3RvciBkaXJlY3RseSBpbnN0ZWFkIGFzIGEgd29ya2Fyb3VuZC4gRm9yIGdlbmVyYWwgZGV0YWlscywgc2VlIGJhYmVsIGJ1ZzpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzMwNDFcbiAgICAvLyBUaGlzIGhhY2sgd2FzIGFkZGVkIGFzIGEgZml4IGZvciB0aGUgaXNzdWUgZGVzY3JpYmVkIGhlcmU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL0ZpbmFuY2lhbC1UaW1lcy9wb2x5ZmlsbC1saWJyYXJ5L3B1bGwvNTkjaXNzdWVjb21tZW50LTQ3NzU1ODA0MlxuXG4gICAgaWYgKCFfdGhpcy5saXN0ZW5lcnMpIHtcbiAgICAgIEVtaXR0ZXIuY2FsbChfYXNzZXJ0VGhpc0luaXRpYWxpemVkKF90aGlzKSk7XG4gICAgfSAvLyBDb21wYXJlZCB0byBhc3NpZ25tZW50LCBPYmplY3QuZGVmaW5lUHJvcGVydHkgbWFrZXMgcHJvcGVydGllcyBub24tZW51bWVyYWJsZSBieSBkZWZhdWx0IGFuZFxuICAgIC8vIHdlIHdhbnQgT2JqZWN0LmtleXMobmV3IEFib3J0Q29udHJvbGxlcigpLnNpZ25hbCkgdG8gYmUgW10gZm9yIGNvbXBhdCB3aXRoIHRoZSBuYXRpdmUgaW1wbFxuXG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX2Fzc2VydFRoaXNJbml0aWFsaXplZChfdGhpcyksICdhYm9ydGVkJywge1xuICAgICAgdmFsdWU6IGZhbHNlLFxuICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX2Fzc2VydFRoaXNJbml0aWFsaXplZChfdGhpcyksICdvbmFib3J0Jywge1xuICAgICAgdmFsdWU6IG51bGwsXG4gICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiBfdGhpcztcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhBYm9ydFNpZ25hbCwgW3tcbiAgICBrZXk6IFwidG9TdHJpbmdcIixcbiAgICB2YWx1ZTogZnVuY3Rpb24gdG9TdHJpbmcoKSB7XG4gICAgICByZXR1cm4gJ1tvYmplY3QgQWJvcnRTaWduYWxdJztcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6IFwiZGlzcGF0Y2hFdmVudFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBkaXNwYXRjaEV2ZW50KGV2ZW50KSB7XG4gICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2Fib3J0Jykge1xuICAgICAgICB0aGlzLmFib3J0ZWQgPSB0cnVlO1xuXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5vbmFib3J0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhpcy5vbmFib3J0LmNhbGwodGhpcywgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIF9nZXQoX2dldFByb3RvdHlwZU9mKEFib3J0U2lnbmFsLnByb3RvdHlwZSksIFwiZGlzcGF0Y2hFdmVudFwiLCB0aGlzKS5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gQWJvcnRTaWduYWw7XG59KEVtaXR0ZXIpO1xudmFyIEFib3J0Q29udHJvbGxlciA9IC8qI19fUFVSRV9fKi9mdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEFib3J0Q29udHJvbGxlcigpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgQWJvcnRDb250cm9sbGVyKTtcblxuICAgIC8vIENvbXBhcmVkIHRvIGFzc2lnbm1lbnQsIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBtYWtlcyBwcm9wZXJ0aWVzIG5vbi1lbnVtZXJhYmxlIGJ5IGRlZmF1bHQgYW5kXG4gICAgLy8gd2Ugd2FudCBPYmplY3Qua2V5cyhuZXcgQWJvcnRDb250cm9sbGVyKCkpIHRvIGJlIFtdIGZvciBjb21wYXQgd2l0aCB0aGUgbmF0aXZlIGltcGxcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3NpZ25hbCcsIHtcbiAgICAgIHZhbHVlOiBuZXcgQWJvcnRTaWduYWwoKSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoQWJvcnRDb250cm9sbGVyLCBbe1xuICAgIGtleTogXCJhYm9ydFwiLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBhYm9ydCgpIHtcbiAgICAgIHZhciBldmVudDtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgZXZlbnQgPSBuZXcgRXZlbnQoJ2Fib3J0Jyk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgaWYgKCFkb2N1bWVudC5jcmVhdGVFdmVudCkge1xuICAgICAgICAgICAgLy8gRm9yIEludGVybmV0IEV4cGxvcmVyIDg6XG4gICAgICAgICAgICBldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50T2JqZWN0KCk7XG4gICAgICAgICAgICBldmVudC50eXBlID0gJ2Fib3J0JztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gRm9yIEludGVybmV0IEV4cGxvcmVyIDExOlxuICAgICAgICAgICAgZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnRXZlbnQnKTtcbiAgICAgICAgICAgIGV2ZW50LmluaXRFdmVudCgnYWJvcnQnLCBmYWxzZSwgZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBGYWxsYmFjayB3aGVyZSBkb2N1bWVudCBpc24ndCBhdmFpbGFibGU6XG4gICAgICAgICAgZXZlbnQgPSB7XG4gICAgICAgICAgICB0eXBlOiAnYWJvcnQnLFxuICAgICAgICAgICAgYnViYmxlczogZmFsc2UsXG4gICAgICAgICAgICBjYW5jZWxhYmxlOiBmYWxzZVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5zaWduYWwuZGlzcGF0Y2hFdmVudChldmVudCk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiBcInRvU3RyaW5nXCIsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xuICAgICAgcmV0dXJuICdbb2JqZWN0IEFib3J0Q29udHJvbGxlcl0nO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBBYm9ydENvbnRyb2xsZXI7XG59KCk7XG5cbmlmICh0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcbiAgLy8gVGhlc2UgYXJlIG5lY2Vzc2FyeSB0byBtYWtlIHN1cmUgdGhhdCB3ZSBnZXQgY29ycmVjdCBvdXRwdXQgZm9yOlxuICAvLyBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobmV3IEFib3J0Q29udHJvbGxlcigpKVxuICBBYm9ydENvbnRyb2xsZXIucHJvdG90eXBlW1N5bWJvbC50b1N0cmluZ1RhZ10gPSAnQWJvcnRDb250cm9sbGVyJztcbiAgQWJvcnRTaWduYWwucHJvdG90eXBlW1N5bWJvbC50b1N0cmluZ1RhZ10gPSAnQWJvcnRTaWduYWwnO1xufVxuXG5mdW5jdGlvbiBwb2x5ZmlsbE5lZWRlZChzZWxmKSB7XG4gIGlmIChzZWxmLl9fRk9SQ0VfSU5TVEFMTF9BQk9SVENPTlRST0xMRVJfUE9MWUZJTEwpIHtcbiAgICBjb25zb2xlLmxvZygnX19GT1JDRV9JTlNUQUxMX0FCT1JUQ09OVFJPTExFUl9QT0xZRklMTD10cnVlIGlzIHNldCwgd2lsbCBmb3JjZSBpbnN0YWxsIHBvbHlmaWxsJyk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gLy8gTm90ZSB0aGF0IHRoZSBcInVuZmV0Y2hcIiBtaW5pbWFsIGZldGNoIHBvbHlmaWxsIGRlZmluZXMgZmV0Y2goKSB3aXRob3V0XG4gIC8vIGRlZmluaW5nIHdpbmRvdy5SZXF1ZXN0LCBhbmQgdGhpcyBwb2x5ZmlsbCBuZWVkIHRvIHdvcmsgb24gdG9wIG9mIHVuZmV0Y2hcbiAgLy8gc28gdGhlIGJlbG93IGZlYXR1cmUgZGV0ZWN0aW9uIG5lZWRzIHRoZSAhc2VsZi5BYm9ydENvbnRyb2xsZXIgcGFydC5cbiAgLy8gVGhlIFJlcXVlc3QucHJvdG90eXBlIGNoZWNrIGlzIGFsc28gbmVlZGVkIGJlY2F1c2UgU2FmYXJpIHZlcnNpb25zIDExLjEuMlxuICAvLyB1cCB0byBhbmQgaW5jbHVkaW5nIDEyLjEueCBoYXMgYSB3aW5kb3cuQWJvcnRDb250cm9sbGVyIHByZXNlbnQgYnV0IHN0aWxsXG4gIC8vIGRvZXMgTk9UIGNvcnJlY3RseSBpbXBsZW1lbnQgYWJvcnRhYmxlIGZldGNoOlxuICAvLyBodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTc0OTgwI2MyXG5cblxuICByZXR1cm4gdHlwZW9mIHNlbGYuUmVxdWVzdCA9PT0gJ2Z1bmN0aW9uJyAmJiAhc2VsZi5SZXF1ZXN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSgnc2lnbmFsJykgfHwgIXNlbGYuQWJvcnRDb250cm9sbGVyO1xufVxuXG4vKipcbiAqIE5vdGU6IHRoZSBcImZldGNoLlJlcXVlc3RcIiBkZWZhdWx0IHZhbHVlIGlzIGF2YWlsYWJsZSBmb3IgZmV0Y2ggaW1wb3J0ZWQgZnJvbVxuICogdGhlIFwibm9kZS1mZXRjaFwiIHBhY2thZ2UgYW5kIG5vdCBpbiBicm93c2Vycy4gVGhpcyBpcyBPSyBzaW5jZSBicm93c2Vyc1xuICogd2lsbCBiZSBpbXBvcnRpbmcgdW1kLXBvbHlmaWxsLmpzIGZyb20gdGhhdCBwYXRoIFwic2VsZlwiIGlzIHBhc3NlZCB0aGVcbiAqIGRlY29yYXRvciBzbyB0aGUgZGVmYXVsdCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkIChiZWNhdXNlIGJyb3dzZXJzIHRoYXQgZGVmaW5lXG4gKiBmZXRjaCBhbHNvIGhhcyBSZXF1ZXN0KS4gT25lIHF1aXJreSBzZXR1cCB3aGVyZSBzZWxmLmZldGNoIGV4aXN0cyBidXRcbiAqIHNlbGYuUmVxdWVzdCBkb2VzIG5vdCBpcyB3aGVuIHRoZSBcInVuZmV0Y2hcIiBtaW5pbWFsIGZldGNoIHBvbHlmaWxsIGlzIHVzZWRcbiAqIG9uIHRvcCBvZiBJRTExOyBmb3IgdGhpcyBjYXNlIHRoZSBicm93c2VyIHdpbGwgdHJ5IHRvIHVzZSB0aGUgZmV0Y2guUmVxdWVzdFxuICogZGVmYXVsdCB2YWx1ZSB3aGljaCBpbiB0dXJuIHdpbGwgYmUgdW5kZWZpbmVkIGJ1dCB0aGVuIHRoZW4gXCJpZiAoUmVxdWVzdClcIlxuICogd2lsbCBlbnN1cmUgdGhhdCB5b3UgZ2V0IGEgcGF0Y2hlZCBmZXRjaCBidXQgc3RpbGwgbm8gUmVxdWVzdCAoYXMgZXhwZWN0ZWQpLlxuICogQHBhcmFtIHtmZXRjaCwgUmVxdWVzdCA9IGZldGNoLlJlcXVlc3R9XG4gKiBAcmV0dXJucyB7ZmV0Y2g6IGFib3J0YWJsZUZldGNoLCBSZXF1ZXN0OiBBYm9ydGFibGVSZXF1ZXN0fVxuICovXG5cbmZ1bmN0aW9uIGFib3J0YWJsZUZldGNoRGVjb3JhdG9yKHBhdGNoVGFyZ2V0cykge1xuICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBhdGNoVGFyZ2V0cykge1xuICAgIHBhdGNoVGFyZ2V0cyA9IHtcbiAgICAgIGZldGNoOiBwYXRjaFRhcmdldHNcbiAgICB9O1xuICB9XG5cbiAgdmFyIF9wYXRjaFRhcmdldHMgPSBwYXRjaFRhcmdldHMsXG4gICAgICBmZXRjaCA9IF9wYXRjaFRhcmdldHMuZmV0Y2gsXG4gICAgICBfcGF0Y2hUYXJnZXRzJFJlcXVlc3QgPSBfcGF0Y2hUYXJnZXRzLlJlcXVlc3QsXG4gICAgICBOYXRpdmVSZXF1ZXN0ID0gX3BhdGNoVGFyZ2V0cyRSZXF1ZXN0ID09PSB2b2lkIDAgPyBmZXRjaC5SZXF1ZXN0IDogX3BhdGNoVGFyZ2V0cyRSZXF1ZXN0LFxuICAgICAgTmF0aXZlQWJvcnRDb250cm9sbGVyID0gX3BhdGNoVGFyZ2V0cy5BYm9ydENvbnRyb2xsZXIsXG4gICAgICBfcGF0Y2hUYXJnZXRzJF9fRk9SQ0UgPSBfcGF0Y2hUYXJnZXRzLl9fRk9SQ0VfSU5TVEFMTF9BQk9SVENPTlRST0xMRVJfUE9MWUZJTEwsXG4gICAgICBfX0ZPUkNFX0lOU1RBTExfQUJPUlRDT05UUk9MTEVSX1BPTFlGSUxMID0gX3BhdGNoVGFyZ2V0cyRfX0ZPUkNFID09PSB2b2lkIDAgPyBmYWxzZSA6IF9wYXRjaFRhcmdldHMkX19GT1JDRTtcblxuICBpZiAoIXBvbHlmaWxsTmVlZGVkKHtcbiAgICBmZXRjaDogZmV0Y2gsXG4gICAgUmVxdWVzdDogTmF0aXZlUmVxdWVzdCxcbiAgICBBYm9ydENvbnRyb2xsZXI6IE5hdGl2ZUFib3J0Q29udHJvbGxlcixcbiAgICBfX0ZPUkNFX0lOU1RBTExfQUJPUlRDT05UUk9MTEVSX1BPTFlGSUxMOiBfX0ZPUkNFX0lOU1RBTExfQUJPUlRDT05UUk9MTEVSX1BPTFlGSUxMXG4gIH0pKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGZldGNoOiBmZXRjaCxcbiAgICAgIFJlcXVlc3Q6IFJlcXVlc3RcbiAgICB9O1xuICB9XG5cbiAgdmFyIFJlcXVlc3QgPSBOYXRpdmVSZXF1ZXN0OyAvLyBOb3RlIHRoYXQgdGhlIFwidW5mZXRjaFwiIG1pbmltYWwgZmV0Y2ggcG9seWZpbGwgZGVmaW5lcyBmZXRjaCgpIHdpdGhvdXRcbiAgLy8gZGVmaW5pbmcgd2luZG93LlJlcXVlc3QsIGFuZCB0aGlzIHBvbHlmaWxsIG5lZWQgdG8gd29yayBvbiB0b3Agb2YgdW5mZXRjaFxuICAvLyBoZW5jZSB3ZSBvbmx5IHBhdGNoIGl0IGlmIGl0J3MgYXZhaWxhYmxlLiBBbHNvIHdlIGRvbid0IHBhdGNoIGl0IGlmIHNpZ25hbFxuICAvLyBpcyBhbHJlYWR5IGF2YWlsYWJsZSBvbiB0aGUgUmVxdWVzdCBwcm90b3R5cGUgYmVjYXVzZSBpbiB0aGlzIGNhc2Ugc3VwcG9ydFxuICAvLyBpcyBwcmVzZW50IGFuZCB0aGUgcGF0Y2hpbmcgYmVsb3cgY2FuIGNhdXNlIGEgY3Jhc2ggc2luY2UgaXQgYXNzaWducyB0b1xuICAvLyByZXF1ZXN0LnNpZ25hbCB3aGljaCBpcyB0ZWNobmljYWxseSBhIHJlYWQtb25seSBwcm9wZXJ0eS4gVGhpcyBsYXR0ZXIgZXJyb3JcbiAgLy8gaGFwcGVucyB3aGVuIHlvdSBydW4gdGhlIG1haW41LmpzIG5vZGUtZmV0Y2ggZXhhbXBsZSBpbiB0aGUgcmVwb1xuICAvLyBcImFib3J0Y29udHJvbGxlci1wb2x5ZmlsbC1leGFtcGxlc1wiLiBUaGUgZXhhY3QgZXJyb3IgaXM6XG4gIC8vICAgcmVxdWVzdC5zaWduYWwgPSBpbml0LnNpZ25hbDtcbiAgLy8gICBeXG4gIC8vIFR5cGVFcnJvcjogQ2Fubm90IHNldCBwcm9wZXJ0eSBzaWduYWwgb2YgIzxSZXF1ZXN0PiB3aGljaCBoYXMgb25seSBhIGdldHRlclxuXG4gIGlmIChSZXF1ZXN0ICYmICFSZXF1ZXN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSgnc2lnbmFsJykgfHwgX19GT1JDRV9JTlNUQUxMX0FCT1JUQ09OVFJPTExFUl9QT0xZRklMTCkge1xuICAgIFJlcXVlc3QgPSBmdW5jdGlvbiBSZXF1ZXN0KGlucHV0LCBpbml0KSB7XG4gICAgICB2YXIgc2lnbmFsO1xuXG4gICAgICBpZiAoaW5pdCAmJiBpbml0LnNpZ25hbCkge1xuICAgICAgICBzaWduYWwgPSBpbml0LnNpZ25hbDsgLy8gTmV2ZXIgcGFzcyBpbml0LnNpZ25hbCB0byB0aGUgbmF0aXZlIFJlcXVlc3QgaW1wbGVtZW50YXRpb24gd2hlbiB0aGUgcG9seWZpbGwgaGFzXG4gICAgICAgIC8vIGJlZW4gaW5zdGFsbGVkIGJlY2F1c2UgaWYgd2UncmUgcnVubmluZyBvbiB0b3Agb2YgYSBicm93c2VyIHdpdGggYVxuICAgICAgICAvLyB3b3JraW5nIG5hdGl2ZSBBYm9ydENvbnRyb2xsZXIgKGkuZS4gdGhlIHBvbHlmaWxsIHdhcyBpbnN0YWxsZWQgZHVlIHRvXG4gICAgICAgIC8vIF9fRk9SQ0VfSU5TVEFMTF9BQk9SVENPTlRST0xMRVJfUE9MWUZJTEwgYmVpbmcgc2V0KSwgdGhlbiBwYXNzaW5nIG91clxuICAgICAgICAvLyBmYWtlIEFib3J0U2lnbmFsIHRvIHRoZSBuYXRpdmUgZmV0Y2ggd2lsbCB0cmlnZ2VyOlxuICAgICAgICAvLyBUeXBlRXJyb3I6IEZhaWxlZCB0byBjb25zdHJ1Y3QgJ1JlcXVlc3QnOiBtZW1iZXIgc2lnbmFsIGlzIG5vdCBvZiB0eXBlIEFib3J0U2lnbmFsLlxuXG4gICAgICAgIGRlbGV0ZSBpbml0LnNpZ25hbDtcbiAgICAgIH1cblxuICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgTmF0aXZlUmVxdWVzdChpbnB1dCwgaW5pdCk7XG5cbiAgICAgIGlmIChzaWduYWwpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlcXVlc3QsICdzaWduYWwnLCB7XG4gICAgICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICB2YWx1ZTogc2lnbmFsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVxdWVzdDtcbiAgICB9O1xuXG4gICAgUmVxdWVzdC5wcm90b3R5cGUgPSBOYXRpdmVSZXF1ZXN0LnByb3RvdHlwZTtcbiAgfVxuXG4gIHZhciByZWFsRmV0Y2ggPSBmZXRjaDtcblxuICB2YXIgYWJvcnRhYmxlRmV0Y2ggPSBmdW5jdGlvbiBhYm9ydGFibGVGZXRjaChpbnB1dCwgaW5pdCkge1xuICAgIHZhciBzaWduYWwgPSBSZXF1ZXN0ICYmIFJlcXVlc3QucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoaW5wdXQpID8gaW5wdXQuc2lnbmFsIDogaW5pdCA/IGluaXQuc2lnbmFsIDogdW5kZWZpbmVkO1xuXG4gICAgaWYgKHNpZ25hbCkge1xuICAgICAgdmFyIGFib3J0RXJyb3I7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGFib3J0RXJyb3IgPSBuZXcgRE9NRXhjZXB0aW9uKCdBYm9ydGVkJywgJ0Fib3J0RXJyb3InKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBJRSAxMSBkb2VzIG5vdCBzdXBwb3J0IGNhbGxpbmcgdGhlIERPTUV4Y2VwdGlvbiBjb25zdHJ1Y3RvciwgdXNlIGFcbiAgICAgICAgLy8gcmVndWxhciBlcnJvciBvYmplY3Qgb24gaXQgaW5zdGVhZC5cbiAgICAgICAgYWJvcnRFcnJvciA9IG5ldyBFcnJvcignQWJvcnRlZCcpO1xuICAgICAgICBhYm9ydEVycm9yLm5hbWUgPSAnQWJvcnRFcnJvcic7XG4gICAgICB9IC8vIFJldHVybiBlYXJseSBpZiBhbHJlYWR5IGFib3J0ZWQsIHRodXMgYXZvaWRpbmcgbWFraW5nIGFuIEhUVFAgcmVxdWVzdFxuXG5cbiAgICAgIGlmIChzaWduYWwuYWJvcnRlZCkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoYWJvcnRFcnJvcik7XG4gICAgICB9IC8vIFR1cm4gYW4gZXZlbnQgaW50byBhIHByb21pc2UsIHJlamVjdCBpdCBvbmNlIGBhYm9ydGAgaXMgZGlzcGF0Y2hlZFxuXG5cbiAgICAgIHZhciBjYW5jZWxsYXRpb24gPSBuZXcgUHJvbWlzZShmdW5jdGlvbiAoXywgcmVqZWN0KSB7XG4gICAgICAgIHNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGFib3J0RXJyb3IpO1xuICAgICAgICB9LCB7XG4gICAgICAgICAgb25jZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaW5pdCAmJiBpbml0LnNpZ25hbCkge1xuICAgICAgICAvLyBOZXZlciBwYXNzIC5zaWduYWwgdG8gdGhlIG5hdGl2ZSBpbXBsZW1lbnRhdGlvbiB3aGVuIHRoZSBwb2x5ZmlsbCBoYXNcbiAgICAgICAgLy8gYmVlbiBpbnN0YWxsZWQgYmVjYXVzZSBpZiB3ZSdyZSBydW5uaW5nIG9uIHRvcCBvZiBhIGJyb3dzZXIgd2l0aCBhXG4gICAgICAgIC8vIHdvcmtpbmcgbmF0aXZlIEFib3J0Q29udHJvbGxlciAoaS5lLiB0aGUgcG9seWZpbGwgd2FzIGluc3RhbGxlZCBkdWUgdG9cbiAgICAgICAgLy8gX19GT1JDRV9JTlNUQUxMX0FCT1JUQ09OVFJPTExFUl9QT0xZRklMTCBiZWluZyBzZXQpLCB0aGVuIHBhc3Npbmcgb3VyXG4gICAgICAgIC8vIGZha2UgQWJvcnRTaWduYWwgdG8gdGhlIG5hdGl2ZSBmZXRjaCB3aWxsIHRyaWdnZXI6XG4gICAgICAgIC8vIFR5cGVFcnJvcjogRmFpbGVkIHRvIGV4ZWN1dGUgJ2ZldGNoJyBvbiAnV2luZG93JzogbWVtYmVyIHNpZ25hbCBpcyBub3Qgb2YgdHlwZSBBYm9ydFNpZ25hbC5cbiAgICAgICAgZGVsZXRlIGluaXQuc2lnbmFsO1xuICAgICAgfSAvLyBSZXR1cm4gdGhlIGZhc3Rlc3QgcHJvbWlzZSAoZG9uJ3QgbmVlZCB0byB3YWl0IGZvciByZXF1ZXN0IHRvIGZpbmlzaClcblxuXG4gICAgICByZXR1cm4gUHJvbWlzZS5yYWNlKFtjYW5jZWxsYXRpb24sIHJlYWxGZXRjaChpbnB1dCwgaW5pdCldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVhbEZldGNoKGlucHV0LCBpbml0KTtcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIGZldGNoOiBhYm9ydGFibGVGZXRjaCxcbiAgICBSZXF1ZXN0OiBSZXF1ZXN0XG4gIH07XG59XG5cbmV4cG9ydHMuQWJvcnRDb250cm9sbGVyID0gQWJvcnRDb250cm9sbGVyO1xuZXhwb3J0cy5BYm9ydFNpZ25hbCA9IEFib3J0U2lnbmFsO1xuZXhwb3J0cy5hYm9ydGFibGVGZXRjaCA9IGFib3J0YWJsZUZldGNoRGVjb3JhdG9yO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vLyBpc3RhbmJ1bCBpZ25vcmUgZmlsZVxudmFyIEFib3J0Q29udHJvbGxlcjtcbmlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykge1xuICAgIEFib3J0Q29udHJvbGxlciA9IHJlcXVpcmUoJ2Fib3J0LWNvbnRyb2xsZXInKTtcbn1cbmVsc2UgaWYgKCdzaWduYWwnIGluIG5ldyBSZXF1ZXN0KCcnKSkge1xuICAgIEFib3J0Q29udHJvbGxlciA9IHdpbmRvdy5BYm9ydENvbnRyb2xsZXI7XG59XG5lbHNlIHtcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdmFyLXJlcXVpcmVzICovXG4gICAgdmFyIHBvbHlmaWxsID0gcmVxdWlyZSgnYWJvcnRjb250cm9sbGVyLXBvbHlmaWxsL2Rpc3QvY2pzLXBvbnlmaWxsJyk7XG4gICAgLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdmFyLXJlcXVpcmVzICovXG4gICAgQWJvcnRDb250cm9sbGVyID0gcG9seWZpbGwuQWJvcnRDb250cm9sbGVyO1xufVxubW9kdWxlLmV4cG9ydHMgPSBBYm9ydENvbnRyb2xsZXI7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1hYm9ydC1jb250cm9sbGVyLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xudmFyIF9faW1wb3J0RGVmYXVsdCA9ICh0aGlzICYmIHRoaXMuX19pbXBvcnREZWZhdWx0KSB8fCBmdW5jdGlvbiAobW9kKSB7XG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBcImRlZmF1bHRcIjogbW9kIH07XG59O1xudmFyIGJhc2VfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiLi9iYXNlXCIpKTtcbnZhciByZWNvcmRfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiLi9yZWNvcmRcIikpO1xudmFyIHRhYmxlXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vdGFibGVcIikpO1xudmFyIGFpcnRhYmxlX2Vycm9yXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vYWlydGFibGVfZXJyb3JcIikpO1xudmFyIEFpcnRhYmxlID0gLyoqIEBjbGFzcyAqLyAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEFpcnRhYmxlKG9wdHMpIHtcbiAgICAgICAgaWYgKG9wdHMgPT09IHZvaWQgMCkgeyBvcHRzID0ge307IH1cbiAgICAgICAgdmFyIGRlZmF1bHRDb25maWcgPSBBaXJ0YWJsZS5kZWZhdWx0X2NvbmZpZygpO1xuICAgICAgICB2YXIgYXBpVmVyc2lvbiA9IG9wdHMuYXBpVmVyc2lvbiB8fCBBaXJ0YWJsZS5hcGlWZXJzaW9uIHx8IGRlZmF1bHRDb25maWcuYXBpVmVyc2lvbjtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgICAgICAgX2FwaUtleToge1xuICAgICAgICAgICAgICAgIHZhbHVlOiBvcHRzLmFwaUtleSB8fCBBaXJ0YWJsZS5hcGlLZXkgfHwgZGVmYXVsdENvbmZpZy5hcGlLZXksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgX2FwaVZlcnNpb246IHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogYXBpVmVyc2lvbixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBfYXBpVmVyc2lvbk1ham9yOiB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IGFwaVZlcnNpb24uc3BsaXQoJy4nKVswXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBfY3VzdG9tSGVhZGVyczoge1xuICAgICAgICAgICAgICAgIHZhbHVlOiBvcHRzLmN1c3RvbUhlYWRlcnMgfHwge30sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgX2VuZHBvaW50VXJsOiB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IG9wdHMuZW5kcG9pbnRVcmwgfHwgQWlydGFibGUuZW5kcG9pbnRVcmwgfHwgZGVmYXVsdENvbmZpZy5lbmRwb2ludFVybCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBfbm9SZXRyeUlmUmF0ZUxpbWl0ZWQ6IHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogb3B0cy5ub1JldHJ5SWZSYXRlTGltaXRlZCB8fFxuICAgICAgICAgICAgICAgICAgICBBaXJ0YWJsZS5ub1JldHJ5SWZSYXRlTGltaXRlZCB8fFxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0Q29uZmlnLm5vUmV0cnlJZlJhdGVMaW1pdGVkLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF9yZXF1ZXN0VGltZW91dDoge1xuICAgICAgICAgICAgICAgIHZhbHVlOiBvcHRzLnJlcXVlc3RUaW1lb3V0IHx8IEFpcnRhYmxlLnJlcXVlc3RUaW1lb3V0IHx8IGRlZmF1bHRDb25maWcucmVxdWVzdFRpbWVvdXQsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCF0aGlzLl9hcGlLZXkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQW4gQVBJIGtleSBpcyByZXF1aXJlZCB0byBjb25uZWN0IHRvIEFpcnRhYmxlJyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgQWlydGFibGUucHJvdG90eXBlLmJhc2UgPSBmdW5jdGlvbiAoYmFzZUlkKSB7XG4gICAgICAgIHJldHVybiBiYXNlXzEuZGVmYXVsdC5jcmVhdGVGdW5jdG9yKHRoaXMsIGJhc2VJZCk7XG4gICAgfTtcbiAgICBBaXJ0YWJsZS5kZWZhdWx0X2NvbmZpZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGVuZHBvaW50VXJsOiBwcm9jZXNzLmVudi5BSVJUQUJMRV9FTkRQT0lOVF9VUkwgfHwgJ2h0dHBzOi8vYXBpLmFpcnRhYmxlLmNvbScsXG4gICAgICAgICAgICBhcGlWZXJzaW9uOiAnMC4xLjAnLFxuICAgICAgICAgICAgYXBpS2V5OiBwcm9jZXNzLmVudi5BSVJUQUJMRV9BUElfS0VZLFxuICAgICAgICAgICAgbm9SZXRyeUlmUmF0ZUxpbWl0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgcmVxdWVzdFRpbWVvdXQ6IDMwMCAqIDEwMDAsXG4gICAgICAgIH07XG4gICAgfTtcbiAgICBBaXJ0YWJsZS5jb25maWd1cmUgPSBmdW5jdGlvbiAoX2EpIHtcbiAgICAgICAgdmFyIGFwaUtleSA9IF9hLmFwaUtleSwgZW5kcG9pbnRVcmwgPSBfYS5lbmRwb2ludFVybCwgYXBpVmVyc2lvbiA9IF9hLmFwaVZlcnNpb24sIG5vUmV0cnlJZlJhdGVMaW1pdGVkID0gX2Eubm9SZXRyeUlmUmF0ZUxpbWl0ZWQsIHJlcXVlc3RUaW1lb3V0ID0gX2EucmVxdWVzdFRpbWVvdXQ7XG4gICAgICAgIEFpcnRhYmxlLmFwaUtleSA9IGFwaUtleTtcbiAgICAgICAgQWlydGFibGUuZW5kcG9pbnRVcmwgPSBlbmRwb2ludFVybDtcbiAgICAgICAgQWlydGFibGUuYXBpVmVyc2lvbiA9IGFwaVZlcnNpb247XG4gICAgICAgIEFpcnRhYmxlLm5vUmV0cnlJZlJhdGVMaW1pdGVkID0gbm9SZXRyeUlmUmF0ZUxpbWl0ZWQ7XG4gICAgICAgIEFpcnRhYmxlLnJlcXVlc3RUaW1lb3V0ID0gcmVxdWVzdFRpbWVvdXQ7XG4gICAgfTtcbiAgICBBaXJ0YWJsZS5iYXNlID0gZnVuY3Rpb24gKGJhc2VJZCkge1xuICAgICAgICByZXR1cm4gbmV3IEFpcnRhYmxlKCkuYmFzZShiYXNlSWQpO1xuICAgIH07XG4gICAgQWlydGFibGUuQmFzZSA9IGJhc2VfMS5kZWZhdWx0O1xuICAgIEFpcnRhYmxlLlJlY29yZCA9IHJlY29yZF8xLmRlZmF1bHQ7XG4gICAgQWlydGFibGUuVGFibGUgPSB0YWJsZV8xLmRlZmF1bHQ7XG4gICAgQWlydGFibGUuRXJyb3IgPSBhaXJ0YWJsZV9lcnJvcl8xLmRlZmF1bHQ7XG4gICAgcmV0dXJuIEFpcnRhYmxlO1xufSgpKTtcbm1vZHVsZS5leHBvcnRzID0gQWlydGFibGU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1haXJ0YWJsZS5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBBaXJ0YWJsZUVycm9yID0gLyoqIEBjbGFzcyAqLyAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEFpcnRhYmxlRXJyb3IoZXJyb3IsIG1lc3NhZ2UsIHN0YXR1c0NvZGUpIHtcbiAgICAgICAgdGhpcy5lcnJvciA9IGVycm9yO1xuICAgICAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgICAgICB0aGlzLnN0YXR1c0NvZGUgPSBzdGF0dXNDb2RlO1xuICAgIH1cbiAgICBBaXJ0YWJsZUVycm9yLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZSxcbiAgICAgICAgICAgICcoJyxcbiAgICAgICAgICAgIHRoaXMuZXJyb3IsXG4gICAgICAgICAgICAnKScsXG4gICAgICAgICAgICB0aGlzLnN0YXR1c0NvZGUgPyBcIltIdHRwIGNvZGUgXCIgKyB0aGlzLnN0YXR1c0NvZGUgKyBcIl1cIiA6ICcnLFxuICAgICAgICBdLmpvaW4oJycpO1xuICAgIH07XG4gICAgcmV0dXJuIEFpcnRhYmxlRXJyb3I7XG59KCkpO1xubW9kdWxlLmV4cG9ydHMgPSBBaXJ0YWJsZUVycm9yO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YWlydGFibGVfZXJyb3IuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgX19hc3NpZ24gPSAodGhpcyAmJiB0aGlzLl9fYXNzaWduKSB8fCBmdW5jdGlvbiAoKSB7XG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKVxuICAgICAgICAgICAgICAgIHRbcF0gPSBzW3BdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0O1xuICAgIH07XG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xudmFyIF9faW1wb3J0RGVmYXVsdCA9ICh0aGlzICYmIHRoaXMuX19pbXBvcnREZWZhdWx0KSB8fCBmdW5jdGlvbiAobW9kKSB7XG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBcImRlZmF1bHRcIjogbW9kIH07XG59O1xudmFyIGdldF8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCJsb2Rhc2gvZ2V0XCIpKTtcbnZhciBpc1BsYWluT2JqZWN0XzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcImxvZGFzaC9pc1BsYWluT2JqZWN0XCIpKTtcbnZhciBrZXlzXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcImxvZGFzaC9rZXlzXCIpKTtcbnZhciBmZXRjaF8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCIuL2ZldGNoXCIpKTtcbnZhciBhYm9ydF9jb250cm9sbGVyXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vYWJvcnQtY29udHJvbGxlclwiKSk7XG52YXIgb2JqZWN0X3RvX3F1ZXJ5X3BhcmFtX3N0cmluZ18xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCIuL29iamVjdF90b19xdWVyeV9wYXJhbV9zdHJpbmdcIikpO1xudmFyIGFpcnRhYmxlX2Vycm9yXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vYWlydGFibGVfZXJyb3JcIikpO1xudmFyIHRhYmxlXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vdGFibGVcIikpO1xudmFyIGh0dHBfaGVhZGVyc18xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCIuL2h0dHBfaGVhZGVyc1wiKSk7XG52YXIgcnVuX2FjdGlvbl8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCIuL3J1bl9hY3Rpb25cIikpO1xudmFyIHBhY2thZ2VfdmVyc2lvbl8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCIuL3BhY2thZ2VfdmVyc2lvblwiKSk7XG52YXIgZXhwb25lbnRpYWxfYmFja29mZl93aXRoX2ppdHRlcl8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCIuL2V4cG9uZW50aWFsX2JhY2tvZmZfd2l0aF9qaXR0ZXJcIikpO1xudmFyIHVzZXJBZ2VudCA9IFwiQWlydGFibGUuanMvXCIgKyBwYWNrYWdlX3ZlcnNpb25fMS5kZWZhdWx0O1xudmFyIEJhc2UgPSAvKiogQGNsYXNzICovIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gQmFzZShhaXJ0YWJsZSwgYmFzZUlkKSB7XG4gICAgICAgIHRoaXMuX2FpcnRhYmxlID0gYWlydGFibGU7XG4gICAgICAgIHRoaXMuX2lkID0gYmFzZUlkO1xuICAgIH1cbiAgICBCYXNlLnByb3RvdHlwZS50YWJsZSA9IGZ1bmN0aW9uICh0YWJsZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyB0YWJsZV8xLmRlZmF1bHQodGhpcywgbnVsbCwgdGFibGVOYW1lKTtcbiAgICB9O1xuICAgIEJhc2UucHJvdG90eXBlLm1ha2VSZXF1ZXN0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdmFyIF9hO1xuICAgICAgICBpZiAob3B0aW9ucyA9PT0gdm9pZCAwKSB7IG9wdGlvbnMgPSB7fTsgfVxuICAgICAgICB2YXIgbWV0aG9kID0gZ2V0XzEuZGVmYXVsdChvcHRpb25zLCAnbWV0aG9kJywgJ0dFVCcpLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIHZhciB1cmwgPSB0aGlzLl9haXJ0YWJsZS5fZW5kcG9pbnRVcmwgKyBcIi92XCIgKyB0aGlzLl9haXJ0YWJsZS5fYXBpVmVyc2lvbk1ham9yICsgXCIvXCIgKyB0aGlzLl9pZCArIGdldF8xLmRlZmF1bHQob3B0aW9ucywgJ3BhdGgnLCAnLycpICsgXCI/XCIgKyBvYmplY3RfdG9fcXVlcnlfcGFyYW1fc3RyaW5nXzEuZGVmYXVsdChnZXRfMS5kZWZhdWx0KG9wdGlvbnMsICdxcycsIHt9KSk7XG4gICAgICAgIHZhciBjb250cm9sbGVyID0gbmV3IGFib3J0X2NvbnRyb2xsZXJfMS5kZWZhdWx0KCk7XG4gICAgICAgIHZhciBoZWFkZXJzID0gdGhpcy5fZ2V0UmVxdWVzdEhlYWRlcnMoT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5fYWlydGFibGUuX2N1c3RvbUhlYWRlcnMsIChfYSA9IG9wdGlvbnMuaGVhZGVycykgIT09IG51bGwgJiYgX2EgIT09IHZvaWQgMCA/IF9hIDoge30pKTtcbiAgICAgICAgdmFyIHJlcXVlc3RPcHRpb25zID0ge1xuICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKCdib2R5JyBpbiBvcHRpb25zICYmIF9jYW5SZXF1ZXN0TWV0aG9kSW5jbHVkZUJvZHkobWV0aG9kKSkge1xuICAgICAgICAgICAgcmVxdWVzdE9wdGlvbnMuYm9keSA9IEpTT04uc3RyaW5naWZ5KG9wdGlvbnMuYm9keSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICAgICAgfSwgdGhpcy5fYWlydGFibGUuX3JlcXVlc3RUaW1lb3V0KTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIGZldGNoXzEuZGVmYXVsdCh1cmwsIHJlcXVlc3RPcHRpb25zKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICAgICAgICAgIGlmIChyZXNwLnN0YXR1cyA9PT0gNDI5ICYmICFfdGhpcy5fYWlydGFibGUuX25vUmV0cnlJZlJhdGVMaW1pdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBudW1BdHRlbXB0c18xID0gZ2V0XzEuZGVmYXVsdChvcHRpb25zLCAnX251bUF0dGVtcHRzJywgMCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBiYWNrb2ZmRGVsYXlNcyA9IGV4cG9uZW50aWFsX2JhY2tvZmZfd2l0aF9qaXR0ZXJfMS5kZWZhdWx0KG51bUF0dGVtcHRzXzEpO1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdPcHRpb25zID0gX19hc3NpZ24oX19hc3NpZ24oe30sIG9wdGlvbnMpLCB7IF9udW1BdHRlbXB0czogbnVtQXR0ZW1wdHNfMSArIDEgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5tYWtlUmVxdWVzdChuZXdPcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKHJlc29sdmUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKHJlamVjdCk7XG4gICAgICAgICAgICAgICAgICAgIH0sIGJhY2tvZmZEZWxheU1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3AuanNvbigpXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbiAoYm9keSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IF90aGlzLl9jaGVja1N0YXR1c0ZvckVycm9yKHJlc3Auc3RhdHVzLCBib2R5KSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9nZXRFcnJvckZvck5vbk9iamVjdEJvZHkocmVzcC5zdGF0dXMsIGJvZHkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IHJlc3Auc3RhdHVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiByZXNwLmhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IGJvZHksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGVyciA9IF9nZXRFcnJvckZvck5vbk9iamVjdEJvZHkocmVzcC5zdGF0dXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgICAgICAgZXJyID0gbmV3IGFpcnRhYmxlX2Vycm9yXzEuZGVmYXVsdCgnQ09OTkVDVElPTl9FUlJPUicsIGVyci5tZXNzYWdlLCBudWxsKTtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBkZXByZWNhdGVkIFRoaXMgbWV0aG9kIGlzIGRlcHJlY2F0ZWQuXG4gICAgICovXG4gICAgQmFzZS5wcm90b3R5cGUucnVuQWN0aW9uID0gZnVuY3Rpb24gKG1ldGhvZCwgcGF0aCwgcXVlcnlQYXJhbXMsIGJvZHlEYXRhLCBjYWxsYmFjaykge1xuICAgICAgICBydW5fYWN0aW9uXzEuZGVmYXVsdCh0aGlzLCBtZXRob2QsIHBhdGgsIHF1ZXJ5UGFyYW1zLCBib2R5RGF0YSwgY2FsbGJhY2ssIDApO1xuICAgIH07XG4gICAgQmFzZS5wcm90b3R5cGUuX2dldFJlcXVlc3RIZWFkZXJzID0gZnVuY3Rpb24gKGhlYWRlcnMpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IG5ldyBodHRwX2hlYWRlcnNfMS5kZWZhdWx0KCk7XG4gICAgICAgIHJlc3VsdC5zZXQoJ0F1dGhvcml6YXRpb24nLCBcIkJlYXJlciBcIiArIHRoaXMuX2FpcnRhYmxlLl9hcGlLZXkpO1xuICAgICAgICByZXN1bHQuc2V0KCdVc2VyLUFnZW50JywgdXNlckFnZW50KTtcbiAgICAgICAgcmVzdWx0LnNldCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBfYSA9IGtleXNfMS5kZWZhdWx0KGhlYWRlcnMpOyBfaSA8IF9hLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgdmFyIGhlYWRlcktleSA9IF9hW19pXTtcbiAgICAgICAgICAgIHJlc3VsdC5zZXQoaGVhZGVyS2V5LCBoZWFkZXJzW2hlYWRlcktleV0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQudG9KU09OKCk7XG4gICAgfTtcbiAgICBCYXNlLnByb3RvdHlwZS5fY2hlY2tTdGF0dXNGb3JFcnJvciA9IGZ1bmN0aW9uIChzdGF0dXNDb2RlLCBib2R5KSB7XG4gICAgICAgIHZhciBfYSA9IChib2R5ICE9PSBudWxsICYmIGJvZHkgIT09IHZvaWQgMCA/IGJvZHkgOiB7IGVycm9yOiB7fSB9KS5lcnJvciwgZXJyb3IgPSBfYSA9PT0gdm9pZCAwID8ge30gOiBfYTtcbiAgICAgICAgdmFyIHR5cGUgPSBlcnJvci50eXBlLCBtZXNzYWdlID0gZXJyb3IubWVzc2FnZTtcbiAgICAgICAgaWYgKHN0YXR1c0NvZGUgPT09IDQwMSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBhaXJ0YWJsZV9lcnJvcl8xLmRlZmF1bHQoJ0FVVEhFTlRJQ0FUSU9OX1JFUVVJUkVEJywgJ1lvdSBzaG91bGQgcHJvdmlkZSB2YWxpZCBhcGkga2V5IHRvIHBlcmZvcm0gdGhpcyBvcGVyYXRpb24nLCBzdGF0dXNDb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzdGF0dXNDb2RlID09PSA0MDMpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgYWlydGFibGVfZXJyb3JfMS5kZWZhdWx0KCdOT1RfQVVUSE9SSVpFRCcsICdZb3UgYXJlIG5vdCBhdXRob3JpemVkIHRvIHBlcmZvcm0gdGhpcyBvcGVyYXRpb24nLCBzdGF0dXNDb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzdGF0dXNDb2RlID09PSA0MDQpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgYWlydGFibGVfZXJyb3JfMS5kZWZhdWx0KCdOT1RfRk9VTkQnLCBtZXNzYWdlICE9PSBudWxsICYmIG1lc3NhZ2UgIT09IHZvaWQgMCA/IG1lc3NhZ2UgOiAnQ291bGQgbm90IGZpbmQgd2hhdCB5b3UgYXJlIGxvb2tpbmcgZm9yJywgc3RhdHVzQ29kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3RhdHVzQ29kZSA9PT0gNDEzKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGFpcnRhYmxlX2Vycm9yXzEuZGVmYXVsdCgnUkVRVUVTVF9UT09fTEFSR0UnLCAnUmVxdWVzdCBib2R5IGlzIHRvbyBsYXJnZScsIHN0YXR1c0NvZGUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHN0YXR1c0NvZGUgPT09IDQyMikge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBhaXJ0YWJsZV9lcnJvcl8xLmRlZmF1bHQodHlwZSAhPT0gbnVsbCAmJiB0eXBlICE9PSB2b2lkIDAgPyB0eXBlIDogJ1VOUFJPQ0VTU0FCTEVfRU5USVRZJywgbWVzc2FnZSAhPT0gbnVsbCAmJiBtZXNzYWdlICE9PSB2b2lkIDAgPyBtZXNzYWdlIDogJ1RoZSBvcGVyYXRpb24gY2Fubm90IGJlIHByb2Nlc3NlZCcsIHN0YXR1c0NvZGUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHN0YXR1c0NvZGUgPT09IDQyOSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBhaXJ0YWJsZV9lcnJvcl8xLmRlZmF1bHQoJ1RPT19NQU5ZX1JFUVVFU1RTJywgJ1lvdSBoYXZlIG1hZGUgdG9vIG1hbnkgcmVxdWVzdHMgaW4gYSBzaG9ydCBwZXJpb2Qgb2YgdGltZS4gUGxlYXNlIHJldHJ5IHlvdXIgcmVxdWVzdCBsYXRlcicsIHN0YXR1c0NvZGUpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHN0YXR1c0NvZGUgPT09IDUwMCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBhaXJ0YWJsZV9lcnJvcl8xLmRlZmF1bHQoJ1NFUlZFUl9FUlJPUicsICdUcnkgYWdhaW4uIElmIHRoZSBwcm9ibGVtIHBlcnNpc3RzLCBjb250YWN0IHN1cHBvcnQuJywgc3RhdHVzQ29kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3RhdHVzQ29kZSA9PT0gNTAzKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGFpcnRhYmxlX2Vycm9yXzEuZGVmYXVsdCgnU0VSVklDRV9VTkFWQUlMQUJMRScsICdUaGUgc2VydmljZSBpcyB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZS4gUGxlYXNlIHJldHJ5IHNob3J0bHkuJywgc3RhdHVzQ29kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3RhdHVzQ29kZSA+PSA0MDApIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgYWlydGFibGVfZXJyb3JfMS5kZWZhdWx0KHR5cGUgIT09IG51bGwgJiYgdHlwZSAhPT0gdm9pZCAwID8gdHlwZSA6ICdVTkVYUEVDVEVEX0VSUk9SJywgbWVzc2FnZSAhPT0gbnVsbCAmJiBtZXNzYWdlICE9PSB2b2lkIDAgPyBtZXNzYWdlIDogJ0FuIHVuZXhwZWN0ZWQgZXJyb3Igb2NjdXJyZWQnLCBzdGF0dXNDb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBCYXNlLnByb3RvdHlwZS5kb0NhbGwgPSBmdW5jdGlvbiAodGFibGVOYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRhYmxlKHRhYmxlTmFtZSk7XG4gICAgfTtcbiAgICBCYXNlLnByb3RvdHlwZS5nZXRJZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lkO1xuICAgIH07XG4gICAgQmFzZS5jcmVhdGVGdW5jdG9yID0gZnVuY3Rpb24gKGFpcnRhYmxlLCBiYXNlSWQpIHtcbiAgICAgICAgdmFyIGJhc2UgPSBuZXcgQmFzZShhaXJ0YWJsZSwgYmFzZUlkKTtcbiAgICAgICAgdmFyIGJhc2VGbiA9IGZ1bmN0aW9uICh0YWJsZU5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBiYXNlLmRvQ2FsbCh0YWJsZU5hbWUpO1xuICAgICAgICB9O1xuICAgICAgICBiYXNlRm4uX2Jhc2UgPSBiYXNlO1xuICAgICAgICBiYXNlRm4udGFibGUgPSBiYXNlLnRhYmxlLmJpbmQoYmFzZSk7XG4gICAgICAgIGJhc2VGbi5tYWtlUmVxdWVzdCA9IGJhc2UubWFrZVJlcXVlc3QuYmluZChiYXNlKTtcbiAgICAgICAgYmFzZUZuLnJ1bkFjdGlvbiA9IGJhc2UucnVuQWN0aW9uLmJpbmQoYmFzZSk7XG4gICAgICAgIGJhc2VGbi5nZXRJZCA9IGJhc2UuZ2V0SWQuYmluZChiYXNlKTtcbiAgICAgICAgcmV0dXJuIGJhc2VGbjtcbiAgICB9O1xuICAgIHJldHVybiBCYXNlO1xufSgpKTtcbmZ1bmN0aW9uIF9jYW5SZXF1ZXN0TWV0aG9kSW5jbHVkZUJvZHkobWV0aG9kKSB7XG4gICAgcmV0dXJuIG1ldGhvZCAhPT0gJ0dFVCcgJiYgbWV0aG9kICE9PSAnREVMRVRFJztcbn1cbmZ1bmN0aW9uIF9nZXRFcnJvckZvck5vbk9iamVjdEJvZHkoc3RhdHVzQ29kZSwgYm9keSkge1xuICAgIGlmIChpc1BsYWluT2JqZWN0XzEuZGVmYXVsdChib2R5KSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgYWlydGFibGVfZXJyb3JfMS5kZWZhdWx0KCdVTkVYUEVDVEVEX0VSUk9SJywgJ1RoZSByZXNwb25zZSBmcm9tIEFpcnRhYmxlIHdhcyBpbnZhbGlkIEpTT04uIFBsZWFzZSB0cnkgYWdhaW4gc29vbi4nLCBzdGF0dXNDb2RlKTtcbiAgICB9XG59XG5tb2R1bGUuZXhwb3J0cyA9IEJhc2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1iYXNlLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuLyoqXG4gKiBHaXZlbiBhIGZ1bmN0aW9uIGZuIHRoYXQgdGFrZXMgYSBjYWxsYmFjayBhcyBpdHMgbGFzdCBhcmd1bWVudCwgcmV0dXJuc1xuICogYSBuZXcgdmVyc2lvbiBvZiB0aGUgZnVuY3Rpb24gdGhhdCB0YWtlcyB0aGUgY2FsbGJhY2sgb3B0aW9uYWxseS4gSWZcbiAqIHRoZSBmdW5jdGlvbiBpcyBub3QgY2FsbGVkIHdpdGggYSBjYWxsYmFjayBmb3IgdGhlIGxhc3QgYXJndW1lbnQsIHRoZVxuICogZnVuY3Rpb24gd2lsbCByZXR1cm4gYSBwcm9taXNlIGluc3RlYWQuXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnksIEB0eXBlc2NyaXB0LWVzbGludC9leHBsaWNpdC1tb2R1bGUtYm91bmRhcnktdHlwZXMgKi9cbmZ1bmN0aW9uIGNhbGxiYWNrVG9Qcm9taXNlKGZuLCBjb250ZXh0LCBjYWxsYmFja0FyZ0luZGV4KSB7XG4gICAgaWYgKGNhbGxiYWNrQXJnSW5kZXggPT09IHZvaWQgMCkgeyBjYWxsYmFja0FyZ0luZGV4ID0gdm9pZCAwOyB9XG4gICAgLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55LCBAdHlwZXNjcmlwdC1lc2xpbnQvZXhwbGljaXQtbW9kdWxlLWJvdW5kYXJ5LXR5cGVzICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNhbGxBcmdzID0gW107XG4gICAgICAgIGZvciAodmFyIF9pID0gMDsgX2kgPCBhcmd1bWVudHMubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICBjYWxsQXJnc1tfaV0gPSBhcmd1bWVudHNbX2ldO1xuICAgICAgICB9XG4gICAgICAgIHZhciB0aGlzQ2FsbGJhY2tBcmdJbmRleDtcbiAgICAgICAgaWYgKGNhbGxiYWNrQXJnSW5kZXggPT09IHZvaWQgMCkge1xuICAgICAgICAgICAgLy8gaXN0YW5idWwgaWdub3JlIG5leHRcbiAgICAgICAgICAgIHRoaXNDYWxsYmFja0FyZ0luZGV4ID0gY2FsbEFyZ3MubGVuZ3RoID4gMCA/IGNhbGxBcmdzLmxlbmd0aCAtIDEgOiAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpc0NhbGxiYWNrQXJnSW5kZXggPSBjYWxsYmFja0FyZ0luZGV4O1xuICAgICAgICB9XG4gICAgICAgIHZhciBjYWxsYmFja0FyZyA9IGNhbGxBcmdzW3RoaXNDYWxsYmFja0FyZ0luZGV4XTtcbiAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFja0FyZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgZm4uYXBwbHkoY29udGV4dCwgY2FsbEFyZ3MpO1xuICAgICAgICAgICAgcmV0dXJuIHZvaWQgMDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBhcmdzXzEgPSBbXTtcbiAgICAgICAgICAgIC8vIElmIGFuIGV4cGxpY2l0IGNhbGxiYWNrQXJnSW5kZXggaXMgc2V0LCBidXQgdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZFxuICAgICAgICAgICAgLy8gd2l0aCB0b28gZmV3IGFyZ3VtZW50cywgd2Ugd2FudCB0byBwdXNoIHVuZGVmaW5lZCBvbnRvIGFyZ3Mgc28gdGhhdFxuICAgICAgICAgICAgLy8gb3VyIGNvbnN0cnVjdGVkIGNhbGxiYWNrIGVuZHMgdXAgYXQgdGhlIHJpZ2h0IGluZGV4LlxuICAgICAgICAgICAgdmFyIGFyZ0xlbiA9IE1hdGgubWF4KGNhbGxBcmdzLmxlbmd0aCwgdGhpc0NhbGxiYWNrQXJnSW5kZXgpO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdMZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGFyZ3NfMS5wdXNoKGNhbGxBcmdzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgYXJnc18xLnB1c2goZnVuY3Rpb24gKGVyciwgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZm4uYXBwbHkoY29udGV4dCwgYXJnc18xKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbm1vZHVsZS5leHBvcnRzID0gY2FsbGJhY2tUb1Byb21pc2U7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jYWxsYmFja190b19wcm9taXNlLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xudmFyIGRpZFdhcm5Gb3JEZXByZWNhdGlvbiA9IHt9O1xuLyoqXG4gKiBDb252ZW5pZW5jZSBmdW5jdGlvbiBmb3IgbWFya2luZyBhIGZ1bmN0aW9uIGFzIGRlcHJlY2F0ZWQuXG4gKlxuICogV2lsbCBlbWl0IGEgd2FybmluZyB0aGUgZmlyc3QgdGltZSB0aGF0IGZ1bmN0aW9uIGlzIGNhbGxlZC5cbiAqXG4gKiBAcGFyYW0gZm4gdGhlIGZ1bmN0aW9uIHRvIG1hcmsgYXMgZGVwcmVjYXRlZC5cbiAqIEBwYXJhbSBrZXkgYSB1bmlxdWUga2V5IGlkZW50aWZ5aW5nIHRoZSBmdW5jdGlvbi5cbiAqIEBwYXJhbSBtZXNzYWdlIHRoZSB3YXJuaW5nIG1lc3NhZ2UuXG4gKlxuICogQHJldHVybiBhIHdyYXBwZWQgZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gZGVwcmVjYXRlKGZuLCBrZXksIG1lc3NhZ2UpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYXJncyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBfaSA9IDA7IF9pIDwgYXJndW1lbnRzLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgYXJnc1tfaV0gPSBhcmd1bWVudHNbX2ldO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZGlkV2FybkZvckRlcHJlY2F0aW9uW2tleV0pIHtcbiAgICAgICAgICAgIGRpZFdhcm5Gb3JEZXByZWNhdGlvbltrZXldID0gdHJ1ZTtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgICBmbi5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9O1xufVxubW9kdWxlLmV4cG9ydHMgPSBkZXByZWNhdGU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kZXByZWNhdGUuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgX19pbXBvcnREZWZhdWx0ID0gKHRoaXMgJiYgdGhpcy5fX2ltcG9ydERlZmF1bHQpIHx8IGZ1bmN0aW9uIChtb2QpIHtcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IFwiZGVmYXVsdFwiOiBtb2QgfTtcbn07XG52YXIgaW50ZXJuYWxfY29uZmlnX2pzb25fMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiLi9pbnRlcm5hbF9jb25maWcuanNvblwiKSk7XG4vLyBcIkZ1bGwgSml0dGVyXCIgYWxnb3JpdGhtIHRha2VuIGZyb20gaHR0cHM6Ly9hd3MuYW1hem9uLmNvbS9ibG9ncy9hcmNoaXRlY3R1cmUvZXhwb25lbnRpYWwtYmFja29mZi1hbmQtaml0dGVyL1xuZnVuY3Rpb24gZXhwb25lbnRpYWxCYWNrb2ZmV2l0aEppdHRlcihudW1iZXJPZlJldHJpZXMpIHtcbiAgICB2YXIgcmF3QmFja29mZlRpbWVNcyA9IGludGVybmFsX2NvbmZpZ19qc29uXzEuZGVmYXVsdC5JTklUSUFMX1JFVFJZX0RFTEFZX0lGX1JBVEVfTElNSVRFRCAqIE1hdGgucG93KDIsIG51bWJlck9mUmV0cmllcyk7XG4gICAgdmFyIGNsaXBwZWRCYWNrb2ZmVGltZU1zID0gTWF0aC5taW4oaW50ZXJuYWxfY29uZmlnX2pzb25fMS5kZWZhdWx0Lk1BWF9SRVRSWV9ERUxBWV9JRl9SQVRFX0xJTUlURUQsIHJhd0JhY2tvZmZUaW1lTXMpO1xuICAgIHZhciBqaXR0ZXJlZEJhY2tvZmZUaW1lTXMgPSBNYXRoLnJhbmRvbSgpICogY2xpcHBlZEJhY2tvZmZUaW1lTXM7XG4gICAgcmV0dXJuIGppdHRlcmVkQmFja29mZlRpbWVNcztcbn1cbm1vZHVsZS5leHBvcnRzID0gZXhwb25lbnRpYWxCYWNrb2ZmV2l0aEppdHRlcjtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWV4cG9uZW50aWFsX2JhY2tvZmZfd2l0aF9qaXR0ZXIuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgX19pbXBvcnREZWZhdWx0ID0gKHRoaXMgJiYgdGhpcy5fX2ltcG9ydERlZmF1bHQpIHx8IGZ1bmN0aW9uIChtb2QpIHtcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IFwiZGVmYXVsdFwiOiBtb2QgfTtcbn07XG4vLyBpc3RhbmJ1bCBpZ25vcmUgZmlsZVxudmFyIG5vZGVfZmV0Y2hfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwibm9kZS1mZXRjaFwiKSk7XG5tb2R1bGUuZXhwb3J0cyA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnID8gbm9kZV9mZXRjaF8xLmRlZmF1bHQgOiB3aW5kb3cuZmV0Y2guYmluZCh3aW5kb3cpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZmV0Y2guanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnkgKi9cbmZ1bmN0aW9uIGhhcyhvYmplY3QsIHByb3BlcnR5KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIHByb3BlcnR5KTtcbn1cbm1vZHVsZS5leHBvcnRzID0gaGFzO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aGFzLmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xudmFyIF9faW1wb3J0RGVmYXVsdCA9ICh0aGlzICYmIHRoaXMuX19pbXBvcnREZWZhdWx0KSB8fCBmdW5jdGlvbiAobW9kKSB7XG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBcImRlZmF1bHRcIjogbW9kIH07XG59O1xudmFyIGtleXNfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwibG9kYXNoL2tleXNcIikpO1xudmFyIGlzQnJvd3NlciA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnO1xudmFyIEh0dHBIZWFkZXJzID0gLyoqIEBjbGFzcyAqLyAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIEh0dHBIZWFkZXJzKCkge1xuICAgICAgICB0aGlzLl9oZWFkZXJzQnlMb3dlcmNhc2VkS2V5ID0ge307XG4gICAgfVxuICAgIEh0dHBIZWFkZXJzLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoaGVhZGVyS2V5LCBoZWFkZXJWYWx1ZSkge1xuICAgICAgICB2YXIgbG93ZXJjYXNlZEtleSA9IGhlYWRlcktleS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZiAobG93ZXJjYXNlZEtleSA9PT0gJ3gtYWlydGFibGUtdXNlci1hZ2VudCcpIHtcbiAgICAgICAgICAgIGxvd2VyY2FzZWRLZXkgPSAndXNlci1hZ2VudCc7XG4gICAgICAgICAgICBoZWFkZXJLZXkgPSAnVXNlci1BZ2VudCc7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faGVhZGVyc0J5TG93ZXJjYXNlZEtleVtsb3dlcmNhc2VkS2V5XSA9IHtcbiAgICAgICAgICAgIGhlYWRlcktleTogaGVhZGVyS2V5LFxuICAgICAgICAgICAgaGVhZGVyVmFsdWU6IGhlYWRlclZhbHVlLFxuICAgICAgICB9O1xuICAgIH07XG4gICAgSHR0cEhlYWRlcnMucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgICAgICBmb3IgKHZhciBfaSA9IDAsIF9hID0ga2V5c18xLmRlZmF1bHQodGhpcy5faGVhZGVyc0J5TG93ZXJjYXNlZEtleSk7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICB2YXIgbG93ZXJjYXNlZEtleSA9IF9hW19pXTtcbiAgICAgICAgICAgIHZhciBoZWFkZXJEZWZpbml0aW9uID0gdGhpcy5faGVhZGVyc0J5TG93ZXJjYXNlZEtleVtsb3dlcmNhc2VkS2V5XTtcbiAgICAgICAgICAgIHZhciBoZWFkZXJLZXkgPSB2b2lkIDA7XG4gICAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICAgICAgaWYgKGlzQnJvd3NlciAmJiBsb3dlcmNhc2VkS2V5ID09PSAndXNlci1hZ2VudCcpIHtcbiAgICAgICAgICAgICAgICAvLyBTb21lIGJyb3dzZXJzIGRvIG5vdCBhbGxvdyBvdmVycmlkaW5nIHRoZSB1c2VyIGFnZW50LlxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9BaXJ0YWJsZS9haXJ0YWJsZS5qcy9pc3N1ZXMvNTJcbiAgICAgICAgICAgICAgICBoZWFkZXJLZXkgPSAnWC1BaXJ0YWJsZS1Vc2VyLUFnZW50JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGhlYWRlcktleSA9IGhlYWRlckRlZmluaXRpb24uaGVhZGVyS2V5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0W2hlYWRlcktleV0gPSBoZWFkZXJEZWZpbml0aW9uLmhlYWRlclZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgICByZXR1cm4gSHR0cEhlYWRlcnM7XG59KCkpO1xubW9kdWxlLmV4cG9ydHMgPSBIdHRwSGVhZGVycztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWh0dHBfaGVhZGVycy5qcy5tYXAiLCJtb2R1bGUuZXhwb3J0cz17XG4gICAgXCJJTklUSUFMX1JFVFJZX0RFTEFZX0lGX1JBVEVfTElNSVRFRFwiOiA1MDAwLFxuICAgIFwiTUFYX1JFVFJZX0RFTEFZX0lGX1JBVEVfTElNSVRFRFwiOiA2MDAwMDBcbn1cbiIsIlwidXNlIHN0cmljdFwiO1xudmFyIF9faW1wb3J0RGVmYXVsdCA9ICh0aGlzICYmIHRoaXMuX19pbXBvcnREZWZhdWx0KSB8fCBmdW5jdGlvbiAobW9kKSB7XG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBcImRlZmF1bHRcIjogbW9kIH07XG59O1xudmFyIGlzQXJyYXlfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwibG9kYXNoL2lzQXJyYXlcIikpO1xudmFyIGlzTmlsXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcImxvZGFzaC9pc05pbFwiKSk7XG52YXIga2V5c18xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCJsb2Rhc2gva2V5c1wiKSk7XG4vKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnkgKi9cbi8vIEFkYXB0ZWQgZnJvbSBqUXVlcnkucGFyYW06XG4vLyBodHRwczovL2dpdGh1Yi5jb20vanF1ZXJ5L2pxdWVyeS9ibG9iLzIuMi1zdGFibGUvc3JjL3NlcmlhbGl6ZS5qc1xuZnVuY3Rpb24gYnVpbGRQYXJhbXMocHJlZml4LCBvYmosIGFkZEZuKSB7XG4gICAgaWYgKGlzQXJyYXlfMS5kZWZhdWx0KG9iaikpIHtcbiAgICAgICAgLy8gU2VyaWFsaXplIGFycmF5IGl0ZW0uXG4gICAgICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBvYmoubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBvYmpbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKC9cXFtcXF0kLy50ZXN0KHByZWZpeCkpIHtcbiAgICAgICAgICAgICAgICAvLyBUcmVhdCBlYWNoIGFycmF5IGl0ZW0gYXMgYSBzY2FsYXIuXG4gICAgICAgICAgICAgICAgYWRkRm4ocHJlZml4LCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBJdGVtIGlzIG5vbi1zY2FsYXIgKGFycmF5IG9yIG9iamVjdCksIGVuY29kZSBpdHMgbnVtZXJpYyBpbmRleC5cbiAgICAgICAgICAgICAgICBidWlsZFBhcmFtcyhwcmVmaXggKyBcIltcIiArICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsID8gaW5kZXggOiAnJykgKyBcIl1cIiwgdmFsdWUsIGFkZEZuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBTZXJpYWxpemUgb2JqZWN0IGl0ZW0uXG4gICAgICAgIGZvciAodmFyIF9pID0gMCwgX2EgPSBrZXlzXzEuZGVmYXVsdChvYmopOyBfaSA8IF9hLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IF9hW19pXTtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IG9ialtrZXldO1xuICAgICAgICAgICAgYnVpbGRQYXJhbXMocHJlZml4ICsgXCJbXCIgKyBrZXkgKyBcIl1cIiwgdmFsdWUsIGFkZEZuKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgLy8gU2VyaWFsaXplIHNjYWxhciBpdGVtLlxuICAgICAgICBhZGRGbihwcmVmaXgsIG9iaik7XG4gICAgfVxufVxuZnVuY3Rpb24gb2JqZWN0VG9RdWVyeVBhcmFtU3RyaW5nKG9iaikge1xuICAgIHZhciBwYXJ0cyA9IFtdO1xuICAgIHZhciBhZGRGbiA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgIHZhbHVlID0gaXNOaWxfMS5kZWZhdWx0KHZhbHVlKSA/ICcnIDogdmFsdWU7XG4gICAgICAgIHBhcnRzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyBcIj1cIiArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpO1xuICAgIH07XG4gICAgZm9yICh2YXIgX2kgPSAwLCBfYSA9IGtleXNfMS5kZWZhdWx0KG9iaik7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBfYVtfaV07XG4gICAgICAgIHZhciB2YWx1ZSA9IG9ialtrZXldO1xuICAgICAgICBidWlsZFBhcmFtcyhrZXksIHZhbHVlLCBhZGRGbik7XG4gICAgfVxuICAgIHJldHVybiBwYXJ0cy5qb2luKCcmJykucmVwbGFjZSgvJTIwL2csICcrJyk7XG59XG5tb2R1bGUuZXhwb3J0cyA9IG9iamVjdFRvUXVlcnlQYXJhbVN0cmluZztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW9iamVjdF90b19xdWVyeV9wYXJhbV9zdHJpbmcuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG5tb2R1bGUuZXhwb3J0cyA9IHByb2Nlc3MuZW52Lm5wbV9wYWNrYWdlX3ZlcnNpb247XG4vLyMgc291cmNlTWFwcGluZ1VSTD1wYWNrYWdlX3ZlcnNpb25fYnJvd3Nlci5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBfX2Fzc2lnbiA9ICh0aGlzICYmIHRoaXMuX19hc3NpZ24pIHx8IGZ1bmN0aW9uICgpIHtcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24odCkge1xuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpXG4gICAgICAgICAgICAgICAgdFtwXSA9IHNbcF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHQ7XG4gICAgfTtcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG52YXIgX19pbXBvcnREZWZhdWx0ID0gKHRoaXMgJiYgdGhpcy5fX2ltcG9ydERlZmF1bHQpIHx8IGZ1bmN0aW9uIChtb2QpIHtcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IFwiZGVmYXVsdFwiOiBtb2QgfTtcbn07XG52YXIgaXNGdW5jdGlvbl8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCJsb2Rhc2gvaXNGdW5jdGlvblwiKSk7XG52YXIga2V5c18xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCJsb2Rhc2gva2V5c1wiKSk7XG52YXIgcmVjb3JkXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vcmVjb3JkXCIpKTtcbnZhciBjYWxsYmFja190b19wcm9taXNlXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vY2FsbGJhY2tfdG9fcHJvbWlzZVwiKSk7XG52YXIgaGFzXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vaGFzXCIpKTtcbnZhciBxdWVyeV9wYXJhbXNfMSA9IHJlcXVpcmUoXCIuL3F1ZXJ5X3BhcmFtc1wiKTtcbi8qKlxuICogQnVpbGRzIGEgcXVlcnkgb2JqZWN0LiBXb24ndCBmZXRjaCB1bnRpbCBgZmlyc3RQYWdlYCBvclxuICogb3IgYGVhY2hQYWdlYCBpcyBjYWxsZWQuXG4gKlxuICogUGFyYW1zIHNob3VsZCBiZSB2YWxpZGF0ZWQgcHJpb3IgdG8gYmVpbmcgcGFzc2VkIHRvIFF1ZXJ5XG4gKiB3aXRoIGBRdWVyeS52YWxpZGF0ZVBhcmFtc2AuXG4gKi9cbnZhciBRdWVyeSA9IC8qKiBAY2xhc3MgKi8gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBRdWVyeSh0YWJsZSwgcGFyYW1zKSB7XG4gICAgICAgIHRoaXMuX3RhYmxlID0gdGFibGU7XG4gICAgICAgIHRoaXMuX3BhcmFtcyA9IHBhcmFtcztcbiAgICAgICAgdGhpcy5maXJzdFBhZ2UgPSBjYWxsYmFja190b19wcm9taXNlXzEuZGVmYXVsdChmaXJzdFBhZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLmVhY2hQYWdlID0gY2FsbGJhY2tfdG9fcHJvbWlzZV8xLmRlZmF1bHQoZWFjaFBhZ2UsIHRoaXMsIDEpO1xuICAgICAgICB0aGlzLmFsbCA9IGNhbGxiYWNrX3RvX3Byb21pc2VfMS5kZWZhdWx0KGFsbCwgdGhpcyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFZhbGlkYXRlcyB0aGUgcGFyYW1ldGVycyBmb3IgcGFzc2luZyB0byB0aGUgUXVlcnkgY29uc3RydWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW1zIHtvYmplY3R9IHBhcmFtcyBwYXJhbWV0ZXJzIHRvIHZhbGlkYXRlXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIGFuIG9iamVjdCB3aXRoIHR3byBrZXlzOlxuICAgICAqICB2YWxpZFBhcmFtczogdGhlIG9iamVjdCB0aGF0IHNob3VsZCBiZSBwYXNzZWQgdG8gdGhlIGNvbnN0cnVjdG9yLlxuICAgICAqICBpZ25vcmVkS2V5czogYSBsaXN0IG9mIGtleXMgdGhhdCB3aWxsIGJlIGlnbm9yZWQuXG4gICAgICogIGVycm9yczogYSBsaXN0IG9mIGVycm9yIG1lc3NhZ2VzLlxuICAgICAqL1xuICAgIFF1ZXJ5LnZhbGlkYXRlUGFyYW1zID0gZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICB2YXIgdmFsaWRQYXJhbXMgPSB7fTtcbiAgICAgICAgdmFyIGlnbm9yZWRLZXlzID0gW107XG4gICAgICAgIHZhciBlcnJvcnMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgX2kgPSAwLCBfYSA9IGtleXNfMS5kZWZhdWx0KHBhcmFtcyk7IF9pIDwgX2EubGVuZ3RoOyBfaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gX2FbX2ldO1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gcGFyYW1zW2tleV07XG4gICAgICAgICAgICBpZiAoaGFzXzEuZGVmYXVsdChRdWVyeS5wYXJhbVZhbGlkYXRvcnMsIGtleSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsaWRhdG9yID0gUXVlcnkucGFyYW1WYWxpZGF0b3JzW2tleV07XG4gICAgICAgICAgICAgICAgdmFyIHZhbGlkYXRpb25SZXN1bHQgPSB2YWxpZGF0b3IodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uUmVzdWx0LnBhc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRQYXJhbXNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JzLnB1c2godmFsaWRhdGlvblJlc3VsdC5lcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWdub3JlZEtleXMucHVzaChrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2YWxpZFBhcmFtczogdmFsaWRQYXJhbXMsXG4gICAgICAgICAgICBpZ25vcmVkS2V5czogaWdub3JlZEtleXMsXG4gICAgICAgICAgICBlcnJvcnM6IGVycm9ycyxcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIFF1ZXJ5LnBhcmFtVmFsaWRhdG9ycyA9IHF1ZXJ5X3BhcmFtc18xLnBhcmFtVmFsaWRhdG9ycztcbiAgICByZXR1cm4gUXVlcnk7XG59KCkpO1xuLyoqXG4gKiBGZXRjaGVzIHRoZSBmaXJzdCBwYWdlIG9mIHJlc3VsdHMgZm9yIHRoZSBxdWVyeSBhc3luY2hyb25vdXNseSxcbiAqIHRoZW4gY2FsbHMgYGRvbmUoZXJyb3IsIHJlY29yZHMpYC5cbiAqL1xuZnVuY3Rpb24gZmlyc3RQYWdlKGRvbmUpIHtcbiAgICBpZiAoIWlzRnVuY3Rpb25fMS5kZWZhdWx0KGRvbmUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIGZpcnN0IHBhcmFtZXRlciB0byBgZmlyc3RQYWdlYCBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgICB9XG4gICAgdGhpcy5lYWNoUGFnZShmdW5jdGlvbiAocmVjb3Jkcykge1xuICAgICAgICBkb25lKG51bGwsIHJlY29yZHMpO1xuICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICBkb25lKGVycm9yLCBudWxsKTtcbiAgICB9KTtcbn1cbi8qKlxuICogRmV0Y2hlcyBlYWNoIHBhZ2Ugb2YgcmVzdWx0cyBmb3IgdGhlIHF1ZXJ5IGFzeW5jaHJvbm91c2x5LlxuICpcbiAqIENhbGxzIGBwYWdlQ2FsbGJhY2socmVjb3JkcywgZmV0Y2hOZXh0UGFnZSlgIGZvciBlYWNoXG4gKiBwYWdlLiBZb3UgbXVzdCBjYWxsIGBmZXRjaE5leHRQYWdlKClgIHRvIGZldGNoIHRoZSBuZXh0IHBhZ2Ugb2ZcbiAqIHJlc3VsdHMuXG4gKlxuICogQWZ0ZXIgZmV0Y2hpbmcgYWxsIHBhZ2VzLCBvciBpZiB0aGVyZSdzIGFuIGVycm9yLCBjYWxsc1xuICogYGRvbmUoZXJyb3IpYC5cbiAqL1xuZnVuY3Rpb24gZWFjaFBhZ2UocGFnZUNhbGxiYWNrLCBkb25lKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcbiAgICBpZiAoIWlzRnVuY3Rpb25fMS5kZWZhdWx0KHBhZ2VDYWxsYmFjaykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgZmlyc3QgcGFyYW1ldGVyIHRvIGBlYWNoUGFnZWAgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIGlmICghaXNGdW5jdGlvbl8xLmRlZmF1bHQoZG9uZSkgJiYgZG9uZSAhPT0gdm9pZCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIHNlY29uZCBwYXJhbWV0ZXIgdG8gYGVhY2hQYWdlYCBtdXN0IGJlIGEgZnVuY3Rpb24gb3IgdW5kZWZpbmVkJyk7XG4gICAgfVxuICAgIHZhciBwYXRoID0gXCIvXCIgKyB0aGlzLl90YWJsZS5fdXJsRW5jb2RlZE5hbWVPcklkKCk7XG4gICAgdmFyIHBhcmFtcyA9IF9fYXNzaWduKHt9LCB0aGlzLl9wYXJhbXMpO1xuICAgIHZhciBpbm5lciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX3RoaXMuX3RhYmxlLl9iYXNlLnJ1bkFjdGlvbignZ2V0JywgcGF0aCwgcGFyYW1zLCBudWxsLCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSwgcmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZG9uZShlcnIsIG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG5leHQgPSB2b2lkIDA7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5vZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLm9mZnNldCA9IHJlc3VsdC5vZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIG5leHQgPSBpbm5lcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgcmVjb3JkcyA9IHJlc3VsdC5yZWNvcmRzLm1hcChmdW5jdGlvbiAocmVjb3JkSnNvbikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IHJlY29yZF8xLmRlZmF1bHQoX3RoaXMuX3RhYmxlLCBudWxsLCByZWNvcmRKc29uKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBwYWdlQ2FsbGJhY2socmVjb3JkcywgbmV4dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgaW5uZXIoKTtcbn1cbi8qKlxuICogRmV0Y2hlcyBhbGwgcGFnZXMgb2YgcmVzdWx0cyBhc3luY2hyb25vdXNseS4gTWF5IHRha2UgYSBsb25nIHRpbWUuXG4gKi9cbmZ1bmN0aW9uIGFsbChkb25lKSB7XG4gICAgaWYgKCFpc0Z1bmN0aW9uXzEuZGVmYXVsdChkb25lKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBmaXJzdCBwYXJhbWV0ZXIgdG8gYGFsbGAgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIHZhciBhbGxSZWNvcmRzID0gW107XG4gICAgdGhpcy5lYWNoUGFnZShmdW5jdGlvbiAocGFnZVJlY29yZHMsIGZldGNoTmV4dFBhZ2UpIHtcbiAgICAgICAgYWxsUmVjb3Jkcy5wdXNoLmFwcGx5KGFsbFJlY29yZHMsIHBhZ2VSZWNvcmRzKTtcbiAgICAgICAgZmV0Y2hOZXh0UGFnZSgpO1xuICAgIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgZG9uZShlcnIsIG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZG9uZShudWxsLCBhbGxSZWNvcmRzKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxubW9kdWxlLmV4cG9ydHMgPSBRdWVyeTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXF1ZXJ5LmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xudmFyIF9faW1wb3J0RGVmYXVsdCA9ICh0aGlzICYmIHRoaXMuX19pbXBvcnREZWZhdWx0KSB8fCBmdW5jdGlvbiAobW9kKSB7XG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBcImRlZmF1bHRcIjogbW9kIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5wYXJhbVZhbGlkYXRvcnMgPSB2b2lkIDA7XG52YXIgdHlwZWNoZWNrXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vdHlwZWNoZWNrXCIpKTtcbnZhciBpc1N0cmluZ18xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCJsb2Rhc2gvaXNTdHJpbmdcIikpO1xudmFyIGlzTnVtYmVyXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcImxvZGFzaC9pc051bWJlclwiKSk7XG52YXIgaXNQbGFpbk9iamVjdF8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCJsb2Rhc2gvaXNQbGFpbk9iamVjdFwiKSk7XG5leHBvcnRzLnBhcmFtVmFsaWRhdG9ycyA9IHtcbiAgICBmaWVsZHM6IHR5cGVjaGVja18xLmRlZmF1bHQodHlwZWNoZWNrXzEuZGVmYXVsdC5pc0FycmF5T2YoaXNTdHJpbmdfMS5kZWZhdWx0KSwgJ3RoZSB2YWx1ZSBmb3IgYGZpZWxkc2Agc2hvdWxkIGJlIGFuIGFycmF5IG9mIHN0cmluZ3MnKSxcbiAgICBmaWx0ZXJCeUZvcm11bGE6IHR5cGVjaGVja18xLmRlZmF1bHQoaXNTdHJpbmdfMS5kZWZhdWx0LCAndGhlIHZhbHVlIGZvciBgZmlsdGVyQnlGb3JtdWxhYCBzaG91bGQgYmUgYSBzdHJpbmcnKSxcbiAgICBtYXhSZWNvcmRzOiB0eXBlY2hlY2tfMS5kZWZhdWx0KGlzTnVtYmVyXzEuZGVmYXVsdCwgJ3RoZSB2YWx1ZSBmb3IgYG1heFJlY29yZHNgIHNob3VsZCBiZSBhIG51bWJlcicpLFxuICAgIHBhZ2VTaXplOiB0eXBlY2hlY2tfMS5kZWZhdWx0KGlzTnVtYmVyXzEuZGVmYXVsdCwgJ3RoZSB2YWx1ZSBmb3IgYHBhZ2VTaXplYCBzaG91bGQgYmUgYSBudW1iZXInKSxcbiAgICBvZmZzZXQ6IHR5cGVjaGVja18xLmRlZmF1bHQoaXNOdW1iZXJfMS5kZWZhdWx0LCAndGhlIHZhbHVlIGZvciBgb2Zmc2V0YCBzaG91bGQgYmUgYSBudW1iZXInKSxcbiAgICBzb3J0OiB0eXBlY2hlY2tfMS5kZWZhdWx0KHR5cGVjaGVja18xLmRlZmF1bHQuaXNBcnJheU9mKGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIChpc1BsYWluT2JqZWN0XzEuZGVmYXVsdChvYmopICYmXG4gICAgICAgICAgICBpc1N0cmluZ18xLmRlZmF1bHQob2JqLmZpZWxkKSAmJlxuICAgICAgICAgICAgKG9iai5kaXJlY3Rpb24gPT09IHZvaWQgMCB8fCBbJ2FzYycsICdkZXNjJ10uaW5jbHVkZXMob2JqLmRpcmVjdGlvbikpKTtcbiAgICB9KSwgJ3RoZSB2YWx1ZSBmb3IgYHNvcnRgIHNob3VsZCBiZSBhbiBhcnJheSBvZiBzb3J0IG9iamVjdHMuICcgK1xuICAgICAgICAnRWFjaCBzb3J0IG9iamVjdCBtdXN0IGhhdmUgYSBzdHJpbmcgYGZpZWxkYCB2YWx1ZSwgYW5kIGFuIG9wdGlvbmFsICcgK1xuICAgICAgICAnYGRpcmVjdGlvbmAgdmFsdWUgdGhhdCBpcyBcImFzY1wiIG9yIFwiZGVzY1wiLicpLFxuICAgIHZpZXc6IHR5cGVjaGVja18xLmRlZmF1bHQoaXNTdHJpbmdfMS5kZWZhdWx0LCAndGhlIHZhbHVlIGZvciBgdmlld2Agc2hvdWxkIGJlIGEgc3RyaW5nJyksXG4gICAgY2VsbEZvcm1hdDogdHlwZWNoZWNrXzEuZGVmYXVsdChmdW5jdGlvbiAoY2VsbEZvcm1hdCkge1xuICAgICAgICByZXR1cm4gaXNTdHJpbmdfMS5kZWZhdWx0KGNlbGxGb3JtYXQpICYmIFsnanNvbicsICdzdHJpbmcnXS5pbmNsdWRlcyhjZWxsRm9ybWF0KTtcbiAgICB9LCAndGhlIHZhbHVlIGZvciBgY2VsbEZvcm1hdGAgc2hvdWxkIGJlIFwianNvblwiIG9yIFwic3RyaW5nXCInKSxcbiAgICB0aW1lWm9uZTogdHlwZWNoZWNrXzEuZGVmYXVsdChpc1N0cmluZ18xLmRlZmF1bHQsICd0aGUgdmFsdWUgZm9yIGB0aW1lWm9uZWAgc2hvdWxkIGJlIGEgc3RyaW5nJyksXG4gICAgdXNlckxvY2FsZTogdHlwZWNoZWNrXzEuZGVmYXVsdChpc1N0cmluZ18xLmRlZmF1bHQsICd0aGUgdmFsdWUgZm9yIGB1c2VyTG9jYWxlYCBzaG91bGQgYmUgYSBzdHJpbmcnKSxcbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1xdWVyeV9wYXJhbXMuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgX19hc3NpZ24gPSAodGhpcyAmJiB0aGlzLl9fYXNzaWduKSB8fCBmdW5jdGlvbiAoKSB7XG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKVxuICAgICAgICAgICAgICAgIHRbcF0gPSBzW3BdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0O1xuICAgIH07XG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xudmFyIF9faW1wb3J0RGVmYXVsdCA9ICh0aGlzICYmIHRoaXMuX19pbXBvcnREZWZhdWx0KSB8fCBmdW5jdGlvbiAobW9kKSB7XG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBcImRlZmF1bHRcIjogbW9kIH07XG59O1xudmFyIGNhbGxiYWNrX3RvX3Byb21pc2VfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiLi9jYWxsYmFja190b19wcm9taXNlXCIpKTtcbnZhciBSZWNvcmQgPSAvKiogQGNsYXNzICovIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gUmVjb3JkKHRhYmxlLCByZWNvcmRJZCwgcmVjb3JkSnNvbikge1xuICAgICAgICB0aGlzLl90YWJsZSA9IHRhYmxlO1xuICAgICAgICB0aGlzLmlkID0gcmVjb3JkSWQgfHwgcmVjb3JkSnNvbi5pZDtcbiAgICAgICAgdGhpcy5zZXRSYXdKc29uKHJlY29yZEpzb24pO1xuICAgICAgICB0aGlzLnNhdmUgPSBjYWxsYmFja190b19wcm9taXNlXzEuZGVmYXVsdChzYXZlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5wYXRjaFVwZGF0ZSA9IGNhbGxiYWNrX3RvX3Byb21pc2VfMS5kZWZhdWx0KHBhdGNoVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5wdXRVcGRhdGUgPSBjYWxsYmFja190b19wcm9taXNlXzEuZGVmYXVsdChwdXRVcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBjYWxsYmFja190b19wcm9taXNlXzEuZGVmYXVsdChkZXN0cm95LCB0aGlzKTtcbiAgICAgICAgdGhpcy5mZXRjaCA9IGNhbGxiYWNrX3RvX3Byb21pc2VfMS5kZWZhdWx0KGZldGNoLCB0aGlzKTtcbiAgICAgICAgdGhpcy51cGRhdGVGaWVsZHMgPSB0aGlzLnBhdGNoVXBkYXRlO1xuICAgICAgICB0aGlzLnJlcGxhY2VGaWVsZHMgPSB0aGlzLnB1dFVwZGF0ZTtcbiAgICB9XG4gICAgUmVjb3JkLnByb3RvdHlwZS5nZXRJZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaWQ7XG4gICAgfTtcbiAgICBSZWNvcmQucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChjb2x1bW5OYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZpZWxkc1tjb2x1bW5OYW1lXTtcbiAgICB9O1xuICAgIFJlY29yZC5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKGNvbHVtbk5hbWUsIGNvbHVtblZhbHVlKSB7XG4gICAgICAgIHRoaXMuZmllbGRzW2NvbHVtbk5hbWVdID0gY29sdW1uVmFsdWU7XG4gICAgfTtcbiAgICBSZWNvcmQucHJvdG90eXBlLnNldFJhd0pzb24gPSBmdW5jdGlvbiAocmF3SnNvbikge1xuICAgICAgICB0aGlzLl9yYXdKc29uID0gcmF3SnNvbjtcbiAgICAgICAgdGhpcy5maWVsZHMgPSAodGhpcy5fcmF3SnNvbiAmJiB0aGlzLl9yYXdKc29uLmZpZWxkcykgfHwge307XG4gICAgfTtcbiAgICByZXR1cm4gUmVjb3JkO1xufSgpKTtcbmZ1bmN0aW9uIHNhdmUoZG9uZSkge1xuICAgIHRoaXMucHV0VXBkYXRlKHRoaXMuZmllbGRzLCBkb25lKTtcbn1cbmZ1bmN0aW9uIHBhdGNoVXBkYXRlKGNlbGxWYWx1ZXNCeU5hbWUsIG9wdHMsIGRvbmUpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgIGlmICghZG9uZSkge1xuICAgICAgICBkb25lID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICB2YXIgdXBkYXRlQm9keSA9IF9fYXNzaWduKHsgZmllbGRzOiBjZWxsVmFsdWVzQnlOYW1lIH0sIG9wdHMpO1xuICAgIHRoaXMuX3RhYmxlLl9iYXNlLnJ1bkFjdGlvbigncGF0Y2gnLCBcIi9cIiArIHRoaXMuX3RhYmxlLl91cmxFbmNvZGVkTmFtZU9ySWQoKSArIFwiL1wiICsgdGhpcy5pZCwge30sIHVwZGF0ZUJvZHksIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlLCByZXN1bHRzKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGRvbmUoZXJyKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBfdGhpcy5zZXRSYXdKc29uKHJlc3VsdHMpO1xuICAgICAgICBkb25lKG51bGwsIF90aGlzKTtcbiAgICB9KTtcbn1cbmZ1bmN0aW9uIHB1dFVwZGF0ZShjZWxsVmFsdWVzQnlOYW1lLCBvcHRzLCBkb25lKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcbiAgICBpZiAoIWRvbmUpIHtcbiAgICAgICAgZG9uZSA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICB9XG4gICAgdmFyIHVwZGF0ZUJvZHkgPSBfX2Fzc2lnbih7IGZpZWxkczogY2VsbFZhbHVlc0J5TmFtZSB9LCBvcHRzKTtcbiAgICB0aGlzLl90YWJsZS5fYmFzZS5ydW5BY3Rpb24oJ3B1dCcsIFwiL1wiICsgdGhpcy5fdGFibGUuX3VybEVuY29kZWROYW1lT3JJZCgpICsgXCIvXCIgKyB0aGlzLmlkLCB7fSwgdXBkYXRlQm9keSwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UsIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIF90aGlzLnNldFJhd0pzb24ocmVzdWx0cyk7XG4gICAgICAgIGRvbmUobnVsbCwgX3RoaXMpO1xuICAgIH0pO1xufVxuZnVuY3Rpb24gZGVzdHJveShkb25lKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcbiAgICB0aGlzLl90YWJsZS5fYmFzZS5ydW5BY3Rpb24oJ2RlbGV0ZScsIFwiL1wiICsgdGhpcy5fdGFibGUuX3VybEVuY29kZWROYW1lT3JJZCgpICsgXCIvXCIgKyB0aGlzLmlkLCB7fSwgbnVsbCwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBkb25lKGVycik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZG9uZShudWxsLCBfdGhpcyk7XG4gICAgfSk7XG59XG5mdW5jdGlvbiBmZXRjaChkb25lKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcbiAgICB0aGlzLl90YWJsZS5fYmFzZS5ydW5BY3Rpb24oJ2dldCcsIFwiL1wiICsgdGhpcy5fdGFibGUuX3VybEVuY29kZWROYW1lT3JJZCgpICsgXCIvXCIgKyB0aGlzLmlkLCB7fSwgbnVsbCwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UsIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIF90aGlzLnNldFJhd0pzb24ocmVzdWx0cyk7XG4gICAgICAgIGRvbmUobnVsbCwgX3RoaXMpO1xuICAgIH0pO1xufVxubW9kdWxlLmV4cG9ydHMgPSBSZWNvcmQ7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yZWNvcmQuanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgX19pbXBvcnREZWZhdWx0ID0gKHRoaXMgJiYgdGhpcy5fX2ltcG9ydERlZmF1bHQpIHx8IGZ1bmN0aW9uIChtb2QpIHtcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IFwiZGVmYXVsdFwiOiBtb2QgfTtcbn07XG52YXIgZXhwb25lbnRpYWxfYmFja29mZl93aXRoX2ppdHRlcl8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCIuL2V4cG9uZW50aWFsX2JhY2tvZmZfd2l0aF9qaXR0ZXJcIikpO1xudmFyIG9iamVjdF90b19xdWVyeV9wYXJhbV9zdHJpbmdfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiLi9vYmplY3RfdG9fcXVlcnlfcGFyYW1fc3RyaW5nXCIpKTtcbnZhciBwYWNrYWdlX3ZlcnNpb25fMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiLi9wYWNrYWdlX3ZlcnNpb25cIikpO1xudmFyIGZldGNoXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vZmV0Y2hcIikpO1xudmFyIGFib3J0X2NvbnRyb2xsZXJfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiLi9hYm9ydC1jb250cm9sbGVyXCIpKTtcbnZhciB1c2VyQWdlbnQgPSBcIkFpcnRhYmxlLmpzL1wiICsgcGFja2FnZV92ZXJzaW9uXzEuZGVmYXVsdDtcbmZ1bmN0aW9uIHJ1bkFjdGlvbihiYXNlLCBtZXRob2QsIHBhdGgsIHF1ZXJ5UGFyYW1zLCBib2R5RGF0YSwgY2FsbGJhY2ssIG51bUF0dGVtcHRzKSB7XG4gICAgdmFyIHVybCA9IGJhc2UuX2FpcnRhYmxlLl9lbmRwb2ludFVybCArIFwiL3ZcIiArIGJhc2UuX2FpcnRhYmxlLl9hcGlWZXJzaW9uTWFqb3IgKyBcIi9cIiArIGJhc2UuX2lkICsgcGF0aCArIFwiP1wiICsgb2JqZWN0X3RvX3F1ZXJ5X3BhcmFtX3N0cmluZ18xLmRlZmF1bHQocXVlcnlQYXJhbXMpO1xuICAgIHZhciBoZWFkZXJzID0ge1xuICAgICAgICBhdXRob3JpemF0aW9uOiBcIkJlYXJlciBcIiArIGJhc2UuX2FpcnRhYmxlLl9hcGlLZXksXG4gICAgICAgICd4LWFwaS12ZXJzaW9uJzogYmFzZS5fYWlydGFibGUuX2FwaVZlcnNpb24sXG4gICAgICAgICd4LWFpcnRhYmxlLWFwcGxpY2F0aW9uLWlkJzogYmFzZS5nZXRJZCgpLFxuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgIH07XG4gICAgdmFyIGlzQnJvd3NlciA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnO1xuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG8gbm90IGFsbG93IG92ZXJyaWRpbmcgdGhlIHVzZXIgYWdlbnQuXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL0FpcnRhYmxlL2FpcnRhYmxlLmpzL2lzc3Vlcy81MlxuICAgIGlmIChpc0Jyb3dzZXIpIHtcbiAgICAgICAgaGVhZGVyc1sneC1haXJ0YWJsZS11c2VyLWFnZW50J10gPSB1c2VyQWdlbnQ7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBoZWFkZXJzWydVc2VyLUFnZW50J10gPSB1c2VyQWdlbnQ7XG4gICAgfVxuICAgIHZhciBjb250cm9sbGVyID0gbmV3IGFib3J0X2NvbnRyb2xsZXJfMS5kZWZhdWx0KCk7XG4gICAgdmFyIG5vcm1hbGl6ZWRNZXRob2QgPSBtZXRob2QudG9VcHBlckNhc2UoKTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgbWV0aG9kOiBub3JtYWxpemVkTWV0aG9kLFxuICAgICAgICBoZWFkZXJzOiBoZWFkZXJzLFxuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgIH07XG4gICAgaWYgKGJvZHlEYXRhICE9PSBudWxsKSB7XG4gICAgICAgIGlmIChub3JtYWxpemVkTWV0aG9kID09PSAnR0VUJyB8fCBub3JtYWxpemVkTWV0aG9kID09PSAnSEVBRCcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignYm9keSBhcmd1bWVudCB0byBydW5BY3Rpb24gYXJlIGlnbm9yZWQgd2l0aCBHRVQgb3IgSEVBRCByZXF1ZXN0cycpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucy5ib2R5ID0gSlNPTi5zdHJpbmdpZnkoYm9keURhdGEpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKTtcbiAgICB9LCBiYXNlLl9haXJ0YWJsZS5fcmVxdWVzdFRpbWVvdXQpO1xuICAgIGZldGNoXzEuZGVmYXVsdCh1cmwsIG9wdGlvbnMpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgaWYgKHJlc3Auc3RhdHVzID09PSA0MjkgJiYgIWJhc2UuX2FpcnRhYmxlLl9ub1JldHJ5SWZSYXRlTGltaXRlZCkge1xuICAgICAgICAgICAgdmFyIGJhY2tvZmZEZWxheU1zID0gZXhwb25lbnRpYWxfYmFja29mZl93aXRoX2ppdHRlcl8xLmRlZmF1bHQobnVtQXR0ZW1wdHMpO1xuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcnVuQWN0aW9uKGJhc2UsIG1ldGhvZCwgcGF0aCwgcXVlcnlQYXJhbXMsIGJvZHlEYXRhLCBjYWxsYmFjaywgbnVtQXR0ZW1wdHMgKyAxKTtcbiAgICAgICAgICAgIH0sIGJhY2tvZmZEZWxheU1zKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3AuanNvbigpXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKGJvZHkpIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBiYXNlLl9jaGVja1N0YXR1c0ZvckVycm9yKHJlc3Auc3RhdHVzLCBib2R5KTtcbiAgICAgICAgICAgICAgICAvLyBFbnN1cmUgUmVzcG9uc2UgaW50ZXJmYWNlIG1hdGNoZXMgaW50ZXJmYWNlIGZyb21cbiAgICAgICAgICAgICAgICAvLyBgcmVxdWVzdGAgUmVzcG9uc2Ugb2JqZWN0XG4gICAgICAgICAgICAgICAgdmFyIHIgPSB7fTtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhyZXNwKS5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wZXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICByW3Byb3BlcnR5XSA9IHJlc3BbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHIuYm9keSA9IGJvZHk7XG4gICAgICAgICAgICAgICAgci5zdGF0dXNDb2RlID0gcmVzcC5zdGF0dXM7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3IsIHIsIGJvZHkpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGJhc2UuX2NoZWNrU3RhdHVzRm9yRXJyb3IocmVzcC5zdGF0dXMpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICB9KTtcbn1cbm1vZHVsZS5leHBvcnRzID0gcnVuQWN0aW9uO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cnVuX2FjdGlvbi5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBfX2Fzc2lnbiA9ICh0aGlzICYmIHRoaXMuX19hc3NpZ24pIHx8IGZ1bmN0aW9uICgpIHtcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24odCkge1xuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpXG4gICAgICAgICAgICAgICAgdFtwXSA9IHNbcF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHQ7XG4gICAgfTtcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG52YXIgX19pbXBvcnREZWZhdWx0ID0gKHRoaXMgJiYgdGhpcy5fX2ltcG9ydERlZmF1bHQpIHx8IGZ1bmN0aW9uIChtb2QpIHtcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IFwiZGVmYXVsdFwiOiBtb2QgfTtcbn07XG52YXIgaXNQbGFpbk9iamVjdF8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCJsb2Rhc2gvaXNQbGFpbk9iamVjdFwiKSk7XG52YXIgZGVwcmVjYXRlXzEgPSBfX2ltcG9ydERlZmF1bHQocmVxdWlyZShcIi4vZGVwcmVjYXRlXCIpKTtcbnZhciBxdWVyeV8xID0gX19pbXBvcnREZWZhdWx0KHJlcXVpcmUoXCIuL3F1ZXJ5XCIpKTtcbnZhciByZWNvcmRfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiLi9yZWNvcmRcIikpO1xudmFyIGNhbGxiYWNrX3RvX3Byb21pc2VfMSA9IF9faW1wb3J0RGVmYXVsdChyZXF1aXJlKFwiLi9jYWxsYmFja190b19wcm9taXNlXCIpKTtcbnZhciBUYWJsZSA9IC8qKiBAY2xhc3MgKi8gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBUYWJsZShiYXNlLCB0YWJsZUlkLCB0YWJsZU5hbWUpIHtcbiAgICAgICAgaWYgKCF0YWJsZUlkICYmICF0YWJsZU5hbWUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGFibGUgbmFtZSBvciB0YWJsZSBJRCBpcyByZXF1aXJlZCcpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2Jhc2UgPSBiYXNlO1xuICAgICAgICB0aGlzLmlkID0gdGFibGVJZDtcbiAgICAgICAgdGhpcy5uYW1lID0gdGFibGVOYW1lO1xuICAgICAgICAvLyBQdWJsaWMgQVBJXG4gICAgICAgIHRoaXMuZmluZCA9IGNhbGxiYWNrX3RvX3Byb21pc2VfMS5kZWZhdWx0KHRoaXMuX2ZpbmRSZWNvcmRCeUlkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5zZWxlY3QgPSB0aGlzLl9zZWxlY3RSZWNvcmRzLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuY3JlYXRlID0gY2FsbGJhY2tfdG9fcHJvbWlzZV8xLmRlZmF1bHQodGhpcy5fY3JlYXRlUmVjb3JkcywgdGhpcyk7XG4gICAgICAgIHRoaXMudXBkYXRlID0gY2FsbGJhY2tfdG9fcHJvbWlzZV8xLmRlZmF1bHQodGhpcy5fdXBkYXRlUmVjb3Jkcy5iaW5kKHRoaXMsIGZhbHNlKSwgdGhpcyk7XG4gICAgICAgIHRoaXMucmVwbGFjZSA9IGNhbGxiYWNrX3RvX3Byb21pc2VfMS5kZWZhdWx0KHRoaXMuX3VwZGF0ZVJlY29yZHMuYmluZCh0aGlzLCB0cnVlKSwgdGhpcyk7XG4gICAgICAgIHRoaXMuZGVzdHJveSA9IGNhbGxiYWNrX3RvX3Byb21pc2VfMS5kZWZhdWx0KHRoaXMuX2Rlc3Ryb3lSZWNvcmQsIHRoaXMpO1xuICAgICAgICAvLyBEZXByZWNhdGVkIEFQSVxuICAgICAgICB0aGlzLmxpc3QgPSBkZXByZWNhdGVfMS5kZWZhdWx0KHRoaXMuX2xpc3RSZWNvcmRzLmJpbmQodGhpcyksICd0YWJsZS5saXN0JywgJ0FpcnRhYmxlOiBgbGlzdCgpYCBpcyBkZXByZWNhdGVkLiBVc2UgYHNlbGVjdCgpYCBpbnN0ZWFkLicpO1xuICAgICAgICB0aGlzLmZvckVhY2ggPSBkZXByZWNhdGVfMS5kZWZhdWx0KHRoaXMuX2ZvckVhY2hSZWNvcmQuYmluZCh0aGlzKSwgJ3RhYmxlLmZvckVhY2gnLCAnQWlydGFibGU6IGBmb3JFYWNoKClgIGlzIGRlcHJlY2F0ZWQuIFVzZSBgc2VsZWN0KClgIGluc3RlYWQuJyk7XG4gICAgfVxuICAgIFRhYmxlLnByb3RvdHlwZS5fZmluZFJlY29yZEJ5SWQgPSBmdW5jdGlvbiAocmVjb3JkSWQsIGRvbmUpIHtcbiAgICAgICAgdmFyIHJlY29yZCA9IG5ldyByZWNvcmRfMS5kZWZhdWx0KHRoaXMsIHJlY29yZElkKTtcbiAgICAgICAgcmVjb3JkLmZldGNoKGRvbmUpO1xuICAgIH07XG4gICAgVGFibGUucHJvdG90eXBlLl9zZWxlY3RSZWNvcmRzID0gZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICBpZiAocGFyYW1zID09PSB2b2lkIDApIHtcbiAgICAgICAgICAgIHBhcmFtcyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQWlydGFibGU6IGBzZWxlY3RgIHRha2VzIG9ubHkgb25lIHBhcmFtZXRlciwgYnV0IGl0IHdhcyBnaXZlbiBcIiArIGFyZ3VtZW50cy5sZW5ndGggKyBcIiBwYXJhbWV0ZXJzLiBVc2UgYGVhY2hQYWdlYCBvciBgZmlyc3RQYWdlYCB0byBmZXRjaCByZWNvcmRzLlwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNQbGFpbk9iamVjdF8xLmRlZmF1bHQocGFyYW1zKSkge1xuICAgICAgICAgICAgdmFyIHZhbGlkYXRpb25SZXN1bHRzID0gcXVlcnlfMS5kZWZhdWx0LnZhbGlkYXRlUGFyYW1zKHBhcmFtcyk7XG4gICAgICAgICAgICBpZiAodmFsaWRhdGlvblJlc3VsdHMuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBmb3JtYXR0ZWRFcnJvcnMgPSB2YWxpZGF0aW9uUmVzdWx0cy5lcnJvcnMubWFwKGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIgICogXCIgKyBlcnJvcjtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBaXJ0YWJsZTogaW52YWxpZCBwYXJhbWV0ZXJzIGZvciBgc2VsZWN0YDpcXG5cIiArIGZvcm1hdHRlZEVycm9ycy5qb2luKCdcXG4nKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodmFsaWRhdGlvblJlc3VsdHMuaWdub3JlZEtleXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQWlydGFibGU6IHRoZSBmb2xsb3dpbmcgcGFyYW1ldGVycyB0byBgc2VsZWN0YCB3aWxsIGJlIGlnbm9yZWQ6IFwiICsgdmFsaWRhdGlvblJlc3VsdHMuaWdub3JlZEtleXMuam9pbignLCAnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3IHF1ZXJ5XzEuZGVmYXVsdCh0aGlzLCB2YWxpZGF0aW9uUmVzdWx0cy52YWxpZFBhcmFtcyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FpcnRhYmxlOiB0aGUgcGFyYW1ldGVyIGZvciBgc2VsZWN0YCBzaG91bGQgYmUgYSBwbGFpbiBvYmplY3Qgb3IgdW5kZWZpbmVkLicpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBUYWJsZS5wcm90b3R5cGUuX3VybEVuY29kZWROYW1lT3JJZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaWQgfHwgZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMubmFtZSk7XG4gICAgfTtcbiAgICBUYWJsZS5wcm90b3R5cGUuX2NyZWF0ZVJlY29yZHMgPSBmdW5jdGlvbiAocmVjb3Jkc0RhdGEsIG9wdGlvbmFsUGFyYW1ldGVycywgZG9uZSkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB2YXIgaXNDcmVhdGluZ011bHRpcGxlUmVjb3JkcyA9IEFycmF5LmlzQXJyYXkocmVjb3Jkc0RhdGEpO1xuICAgICAgICBpZiAoIWRvbmUpIHtcbiAgICAgICAgICAgIGRvbmUgPSBvcHRpb25hbFBhcmFtZXRlcnM7XG4gICAgICAgICAgICBvcHRpb25hbFBhcmFtZXRlcnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmVxdWVzdERhdGE7XG4gICAgICAgIGlmIChpc0NyZWF0aW5nTXVsdGlwbGVSZWNvcmRzKSB7XG4gICAgICAgICAgICByZXF1ZXN0RGF0YSA9IF9fYXNzaWduKHsgcmVjb3JkczogcmVjb3Jkc0RhdGEgfSwgb3B0aW9uYWxQYXJhbWV0ZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlcXVlc3REYXRhID0gX19hc3NpZ24oeyBmaWVsZHM6IHJlY29yZHNEYXRhIH0sIG9wdGlvbmFsUGFyYW1ldGVycyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYmFzZS5ydW5BY3Rpb24oJ3Bvc3QnLCBcIi9cIiArIHRoaXMuX3VybEVuY29kZWROYW1lT3JJZCgpICsgXCIvXCIsIHt9LCByZXF1ZXN0RGF0YSwgZnVuY3Rpb24gKGVyciwgcmVzcCwgYm9keSkge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGRvbmUoZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgcmVzdWx0O1xuICAgICAgICAgICAgaWYgKGlzQ3JlYXRpbmdNdWx0aXBsZVJlY29yZHMpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBib2R5LnJlY29yZHMubWFwKGZ1bmN0aW9uIChyZWNvcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyByZWNvcmRfMS5kZWZhdWx0KF90aGlzLCByZWNvcmQuaWQsIHJlY29yZCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBuZXcgcmVjb3JkXzEuZGVmYXVsdChfdGhpcywgYm9keS5pZCwgYm9keSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkb25lKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgVGFibGUucHJvdG90eXBlLl91cGRhdGVSZWNvcmRzID0gZnVuY3Rpb24gKGlzRGVzdHJ1Y3RpdmVVcGRhdGUsIHJlY29yZHNEYXRhT3JSZWNvcmRJZCwgcmVjb3JkRGF0YU9yT3B0c09yRG9uZSwgb3B0c09yRG9uZSwgZG9uZSkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB2YXIgb3B0cztcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVjb3Jkc0RhdGFPclJlY29yZElkKSkge1xuICAgICAgICAgICAgdmFyIHJlY29yZHNEYXRhID0gcmVjb3Jkc0RhdGFPclJlY29yZElkO1xuICAgICAgICAgICAgb3B0cyA9IGlzUGxhaW5PYmplY3RfMS5kZWZhdWx0KHJlY29yZERhdGFPck9wdHNPckRvbmUpID8gcmVjb3JkRGF0YU9yT3B0c09yRG9uZSA6IHt9O1xuICAgICAgICAgICAgZG9uZSA9IChvcHRzT3JEb25lIHx8IHJlY29yZERhdGFPck9wdHNPckRvbmUpO1xuICAgICAgICAgICAgdmFyIG1ldGhvZCA9IGlzRGVzdHJ1Y3RpdmVVcGRhdGUgPyAncHV0JyA6ICdwYXRjaCc7XG4gICAgICAgICAgICB2YXIgcmVxdWVzdERhdGEgPSBfX2Fzc2lnbih7IHJlY29yZHM6IHJlY29yZHNEYXRhIH0sIG9wdHMpO1xuICAgICAgICAgICAgdGhpcy5fYmFzZS5ydW5BY3Rpb24obWV0aG9kLCBcIi9cIiArIHRoaXMuX3VybEVuY29kZWROYW1lT3JJZCgpICsgXCIvXCIsIHt9LCByZXF1ZXN0RGF0YSwgZnVuY3Rpb24gKGVyciwgcmVzcCwgYm9keSkge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSBib2R5LnJlY29yZHMubWFwKGZ1bmN0aW9uIChyZWNvcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyByZWNvcmRfMS5kZWZhdWx0KF90aGlzLCByZWNvcmQuaWQsIHJlY29yZCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZG9uZShudWxsLCByZXN1bHQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgcmVjb3JkSWQgPSByZWNvcmRzRGF0YU9yUmVjb3JkSWQ7XG4gICAgICAgICAgICB2YXIgcmVjb3JkRGF0YSA9IHJlY29yZERhdGFPck9wdHNPckRvbmU7XG4gICAgICAgICAgICBvcHRzID0gaXNQbGFpbk9iamVjdF8xLmRlZmF1bHQob3B0c09yRG9uZSkgPyBvcHRzT3JEb25lIDoge307XG4gICAgICAgICAgICBkb25lID0gKGRvbmUgfHwgb3B0c09yRG9uZSk7XG4gICAgICAgICAgICB2YXIgcmVjb3JkID0gbmV3IHJlY29yZF8xLmRlZmF1bHQodGhpcywgcmVjb3JkSWQpO1xuICAgICAgICAgICAgaWYgKGlzRGVzdHJ1Y3RpdmVVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICByZWNvcmQucHV0VXBkYXRlKHJlY29yZERhdGEsIG9wdHMsIGRvbmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVjb3JkLnBhdGNoVXBkYXRlKHJlY29yZERhdGEsIG9wdHMsIGRvbmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbiAgICBUYWJsZS5wcm90b3R5cGUuX2Rlc3Ryb3lSZWNvcmQgPSBmdW5jdGlvbiAocmVjb3JkSWRzT3JJZCwgZG9uZSkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyZWNvcmRJZHNPcklkKSkge1xuICAgICAgICAgICAgdmFyIHF1ZXJ5UGFyYW1zID0geyByZWNvcmRzOiByZWNvcmRJZHNPcklkIH07XG4gICAgICAgICAgICB0aGlzLl9iYXNlLnJ1bkFjdGlvbignZGVsZXRlJywgXCIvXCIgKyB0aGlzLl91cmxFbmNvZGVkTmFtZU9ySWQoKSwgcXVlcnlQYXJhbXMsIG51bGwsIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlLCByZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBkb25lKGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIHJlY29yZHMgPSByZXN1bHRzLnJlY29yZHMubWFwKGZ1bmN0aW9uIChfYSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaWQgPSBfYS5pZDtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyByZWNvcmRfMS5kZWZhdWx0KF90aGlzLCBpZCwgbnVsbCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZG9uZShudWxsLCByZWNvcmRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlY29yZCA9IG5ldyByZWNvcmRfMS5kZWZhdWx0KHRoaXMsIHJlY29yZElkc09ySWQpO1xuICAgICAgICAgICAgcmVjb3JkLmRlc3Ryb3koZG9uZSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFRhYmxlLnByb3RvdHlwZS5fbGlzdFJlY29yZHMgPSBmdW5jdGlvbiAobGltaXQsIG9mZnNldCwgb3B0cywgZG9uZSkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAoIWRvbmUpIHtcbiAgICAgICAgICAgIGRvbmUgPSBvcHRzO1xuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHZhciBsaXN0UmVjb3Jkc1BhcmFtZXRlcnMgPSBfX2Fzc2lnbih7IGxpbWl0OiBsaW1pdCxcbiAgICAgICAgICAgIG9mZnNldDogb2Zmc2V0IH0sIG9wdHMpO1xuICAgICAgICB0aGlzLl9iYXNlLnJ1bkFjdGlvbignZ2V0JywgXCIvXCIgKyB0aGlzLl91cmxFbmNvZGVkTmFtZU9ySWQoKSArIFwiL1wiLCBsaXN0UmVjb3Jkc1BhcmFtZXRlcnMsIG51bGwsIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlLCByZXN1bHRzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciByZWNvcmRzID0gcmVzdWx0cy5yZWNvcmRzLm1hcChmdW5jdGlvbiAocmVjb3JkSnNvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgcmVjb3JkXzEuZGVmYXVsdChfdGhpcywgbnVsbCwgcmVjb3JkSnNvbik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGRvbmUobnVsbCwgcmVjb3JkcywgcmVzdWx0cy5vZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFRhYmxlLnByb3RvdHlwZS5fZm9yRWFjaFJlY29yZCA9IGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaywgZG9uZSkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgICAgZG9uZSA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIHZhciBsaW1pdCA9IFRhYmxlLl9fcmVjb3Jkc1BlclBhZ2VGb3JJdGVyYXRpb24gfHwgMTAwO1xuICAgICAgICB2YXIgb2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgdmFyIG5leHRQYWdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgX3RoaXMuX2xpc3RSZWNvcmRzKGxpbWl0LCBvZmZzZXQsIG9wdHMsIGZ1bmN0aW9uIChlcnIsIHBhZ2UsIG5ld09mZnNldCkge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZG9uZShlcnIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBwYWdlLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhwYWdlW2luZGV4XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChuZXdPZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0ID0gbmV3T2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgICBuZXh0UGFnZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBuZXh0UGFnZSgpO1xuICAgIH07XG4gICAgcmV0dXJuIFRhYmxlO1xufSgpKTtcbm1vZHVsZS5leHBvcnRzID0gVGFibGU7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10YWJsZS5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtcbi8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueSAqL1xuZnVuY3Rpb24gY2hlY2soZm4sIGVycm9yKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBpZiAoZm4odmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBwYXNzOiB0cnVlIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4geyBwYXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yIH07XG4gICAgICAgIH1cbiAgICB9O1xufVxuY2hlY2suaXNPbmVPZiA9IGZ1bmN0aW9uIGlzT25lT2Yob3B0aW9ucykge1xuICAgIHJldHVybiBvcHRpb25zLmluY2x1ZGVzLmJpbmQob3B0aW9ucyk7XG59O1xuY2hlY2suaXNBcnJheU9mID0gZnVuY3Rpb24gKGl0ZW1WYWxpZGF0b3IpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5ldmVyeShpdGVtVmFsaWRhdG9yKTtcbiAgICB9O1xufTtcbm1vZHVsZS5leHBvcnRzID0gY2hlY2s7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10eXBlY2hlY2suanMubWFwIiwiIiwidmFyIGhhc2hDbGVhciA9IHJlcXVpcmUoJy4vX2hhc2hDbGVhcicpLFxuICAgIGhhc2hEZWxldGUgPSByZXF1aXJlKCcuL19oYXNoRGVsZXRlJyksXG4gICAgaGFzaEdldCA9IHJlcXVpcmUoJy4vX2hhc2hHZXQnKSxcbiAgICBoYXNoSGFzID0gcmVxdWlyZSgnLi9faGFzaEhhcycpLFxuICAgIGhhc2hTZXQgPSByZXF1aXJlKCcuL19oYXNoU2V0Jyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGhhc2ggb2JqZWN0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7QXJyYXl9IFtlbnRyaWVzXSBUaGUga2V5LXZhbHVlIHBhaXJzIHRvIGNhY2hlLlxuICovXG5mdW5jdGlvbiBIYXNoKGVudHJpZXMpIHtcbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICBsZW5ndGggPSBlbnRyaWVzID09IG51bGwgPyAwIDogZW50cmllcy5sZW5ndGg7XG5cbiAgdGhpcy5jbGVhcigpO1xuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHZhciBlbnRyeSA9IGVudHJpZXNbaW5kZXhdO1xuICAgIHRoaXMuc2V0KGVudHJ5WzBdLCBlbnRyeVsxXSk7XG4gIH1cbn1cblxuLy8gQWRkIG1ldGhvZHMgdG8gYEhhc2hgLlxuSGFzaC5wcm90b3R5cGUuY2xlYXIgPSBoYXNoQ2xlYXI7XG5IYXNoLnByb3RvdHlwZVsnZGVsZXRlJ10gPSBoYXNoRGVsZXRlO1xuSGFzaC5wcm90b3R5cGUuZ2V0ID0gaGFzaEdldDtcbkhhc2gucHJvdG90eXBlLmhhcyA9IGhhc2hIYXM7XG5IYXNoLnByb3RvdHlwZS5zZXQgPSBoYXNoU2V0O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEhhc2g7XG4iLCJ2YXIgbGlzdENhY2hlQ2xlYXIgPSByZXF1aXJlKCcuL19saXN0Q2FjaGVDbGVhcicpLFxuICAgIGxpc3RDYWNoZURlbGV0ZSA9IHJlcXVpcmUoJy4vX2xpc3RDYWNoZURlbGV0ZScpLFxuICAgIGxpc3RDYWNoZUdldCA9IHJlcXVpcmUoJy4vX2xpc3RDYWNoZUdldCcpLFxuICAgIGxpc3RDYWNoZUhhcyA9IHJlcXVpcmUoJy4vX2xpc3RDYWNoZUhhcycpLFxuICAgIGxpc3RDYWNoZVNldCA9IHJlcXVpcmUoJy4vX2xpc3RDYWNoZVNldCcpO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gbGlzdCBjYWNoZSBvYmplY3QuXG4gKlxuICogQHByaXZhdGVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtBcnJheX0gW2VudHJpZXNdIFRoZSBrZXktdmFsdWUgcGFpcnMgdG8gY2FjaGUuXG4gKi9cbmZ1bmN0aW9uIExpc3RDYWNoZShlbnRyaWVzKSB7XG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgbGVuZ3RoID0gZW50cmllcyA9PSBudWxsID8gMCA6IGVudHJpZXMubGVuZ3RoO1xuXG4gIHRoaXMuY2xlYXIoKTtcbiAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICB2YXIgZW50cnkgPSBlbnRyaWVzW2luZGV4XTtcbiAgICB0aGlzLnNldChlbnRyeVswXSwgZW50cnlbMV0pO1xuICB9XG59XG5cbi8vIEFkZCBtZXRob2RzIHRvIGBMaXN0Q2FjaGVgLlxuTGlzdENhY2hlLnByb3RvdHlwZS5jbGVhciA9IGxpc3RDYWNoZUNsZWFyO1xuTGlzdENhY2hlLnByb3RvdHlwZVsnZGVsZXRlJ10gPSBsaXN0Q2FjaGVEZWxldGU7XG5MaXN0Q2FjaGUucHJvdG90eXBlLmdldCA9IGxpc3RDYWNoZUdldDtcbkxpc3RDYWNoZS5wcm90b3R5cGUuaGFzID0gbGlzdENhY2hlSGFzO1xuTGlzdENhY2hlLnByb3RvdHlwZS5zZXQgPSBsaXN0Q2FjaGVTZXQ7XG5cbm1vZHVsZS5leHBvcnRzID0gTGlzdENhY2hlO1xuIiwidmFyIGdldE5hdGl2ZSA9IHJlcXVpcmUoJy4vX2dldE5hdGl2ZScpLFxuICAgIHJvb3QgPSByZXF1aXJlKCcuL19yb290Jyk7XG5cbi8qIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIHRoYXQgYXJlIHZlcmlmaWVkIHRvIGJlIG5hdGl2ZS4gKi9cbnZhciBNYXAgPSBnZXROYXRpdmUocm9vdCwgJ01hcCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hcDtcbiIsInZhciBtYXBDYWNoZUNsZWFyID0gcmVxdWlyZSgnLi9fbWFwQ2FjaGVDbGVhcicpLFxuICAgIG1hcENhY2hlRGVsZXRlID0gcmVxdWlyZSgnLi9fbWFwQ2FjaGVEZWxldGUnKSxcbiAgICBtYXBDYWNoZUdldCA9IHJlcXVpcmUoJy4vX21hcENhY2hlR2V0JyksXG4gICAgbWFwQ2FjaGVIYXMgPSByZXF1aXJlKCcuL19tYXBDYWNoZUhhcycpLFxuICAgIG1hcENhY2hlU2V0ID0gcmVxdWlyZSgnLi9fbWFwQ2FjaGVTZXQnKTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgbWFwIGNhY2hlIG9iamVjdCB0byBzdG9yZSBrZXktdmFsdWUgcGFpcnMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtBcnJheX0gW2VudHJpZXNdIFRoZSBrZXktdmFsdWUgcGFpcnMgdG8gY2FjaGUuXG4gKi9cbmZ1bmN0aW9uIE1hcENhY2hlKGVudHJpZXMpIHtcbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICBsZW5ndGggPSBlbnRyaWVzID09IG51bGwgPyAwIDogZW50cmllcy5sZW5ndGg7XG5cbiAgdGhpcy5jbGVhcigpO1xuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHZhciBlbnRyeSA9IGVudHJpZXNbaW5kZXhdO1xuICAgIHRoaXMuc2V0KGVudHJ5WzBdLCBlbnRyeVsxXSk7XG4gIH1cbn1cblxuLy8gQWRkIG1ldGhvZHMgdG8gYE1hcENhY2hlYC5cbk1hcENhY2hlLnByb3RvdHlwZS5jbGVhciA9IG1hcENhY2hlQ2xlYXI7XG5NYXBDYWNoZS5wcm90b3R5cGVbJ2RlbGV0ZSddID0gbWFwQ2FjaGVEZWxldGU7XG5NYXBDYWNoZS5wcm90b3R5cGUuZ2V0ID0gbWFwQ2FjaGVHZXQ7XG5NYXBDYWNoZS5wcm90b3R5cGUuaGFzID0gbWFwQ2FjaGVIYXM7XG5NYXBDYWNoZS5wcm90b3R5cGUuc2V0ID0gbWFwQ2FjaGVTZXQ7XG5cbm1vZHVsZS5leHBvcnRzID0gTWFwQ2FjaGU7XG4iLCJ2YXIgcm9vdCA9IHJlcXVpcmUoJy4vX3Jvb3QnKTtcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgU3ltYm9sID0gcm9vdC5TeW1ib2w7XG5cbm1vZHVsZS5leHBvcnRzID0gU3ltYm9sO1xuIiwidmFyIGJhc2VUaW1lcyA9IHJlcXVpcmUoJy4vX2Jhc2VUaW1lcycpLFxuICAgIGlzQXJndW1lbnRzID0gcmVxdWlyZSgnLi9pc0FyZ3VtZW50cycpLFxuICAgIGlzQXJyYXkgPSByZXF1aXJlKCcuL2lzQXJyYXknKSxcbiAgICBpc0J1ZmZlciA9IHJlcXVpcmUoJy4vaXNCdWZmZXInKSxcbiAgICBpc0luZGV4ID0gcmVxdWlyZSgnLi9faXNJbmRleCcpLFxuICAgIGlzVHlwZWRBcnJheSA9IHJlcXVpcmUoJy4vaXNUeXBlZEFycmF5Jyk7XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiB0aGUgZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiB0aGUgYXJyYXktbGlrZSBgdmFsdWVgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBxdWVyeS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaW5oZXJpdGVkIFNwZWNpZnkgcmV0dXJuaW5nIGluaGVyaXRlZCBwcm9wZXJ0eSBuYW1lcy5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMuXG4gKi9cbmZ1bmN0aW9uIGFycmF5TGlrZUtleXModmFsdWUsIGluaGVyaXRlZCkge1xuICB2YXIgaXNBcnIgPSBpc0FycmF5KHZhbHVlKSxcbiAgICAgIGlzQXJnID0gIWlzQXJyICYmIGlzQXJndW1lbnRzKHZhbHVlKSxcbiAgICAgIGlzQnVmZiA9ICFpc0FyciAmJiAhaXNBcmcgJiYgaXNCdWZmZXIodmFsdWUpLFxuICAgICAgaXNUeXBlID0gIWlzQXJyICYmICFpc0FyZyAmJiAhaXNCdWZmICYmIGlzVHlwZWRBcnJheSh2YWx1ZSksXG4gICAgICBza2lwSW5kZXhlcyA9IGlzQXJyIHx8IGlzQXJnIHx8IGlzQnVmZiB8fCBpc1R5cGUsXG4gICAgICByZXN1bHQgPSBza2lwSW5kZXhlcyA/IGJhc2VUaW1lcyh2YWx1ZS5sZW5ndGgsIFN0cmluZykgOiBbXSxcbiAgICAgIGxlbmd0aCA9IHJlc3VsdC5sZW5ndGg7XG5cbiAgZm9yICh2YXIga2V5IGluIHZhbHVlKSB7XG4gICAgaWYgKChpbmhlcml0ZWQgfHwgaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwga2V5KSkgJiZcbiAgICAgICAgIShza2lwSW5kZXhlcyAmJiAoXG4gICAgICAgICAgIC8vIFNhZmFyaSA5IGhhcyBlbnVtZXJhYmxlIGBhcmd1bWVudHMubGVuZ3RoYCBpbiBzdHJpY3QgbW9kZS5cbiAgICAgICAgICAga2V5ID09ICdsZW5ndGgnIHx8XG4gICAgICAgICAgIC8vIE5vZGUuanMgMC4xMCBoYXMgZW51bWVyYWJsZSBub24taW5kZXggcHJvcGVydGllcyBvbiBidWZmZXJzLlxuICAgICAgICAgICAoaXNCdWZmICYmIChrZXkgPT0gJ29mZnNldCcgfHwga2V5ID09ICdwYXJlbnQnKSkgfHxcbiAgICAgICAgICAgLy8gUGhhbnRvbUpTIDIgaGFzIGVudW1lcmFibGUgbm9uLWluZGV4IHByb3BlcnRpZXMgb24gdHlwZWQgYXJyYXlzLlxuICAgICAgICAgICAoaXNUeXBlICYmIChrZXkgPT0gJ2J1ZmZlcicgfHwga2V5ID09ICdieXRlTGVuZ3RoJyB8fCBrZXkgPT0gJ2J5dGVPZmZzZXQnKSkgfHxcbiAgICAgICAgICAgLy8gU2tpcCBpbmRleCBwcm9wZXJ0aWVzLlxuICAgICAgICAgICBpc0luZGV4KGtleSwgbGVuZ3RoKVxuICAgICAgICApKSkge1xuICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhcnJheUxpa2VLZXlzO1xuIiwiLyoqXG4gKiBBIHNwZWNpYWxpemVkIHZlcnNpb24gb2YgYF8ubWFwYCBmb3IgYXJyYXlzIHdpdGhvdXQgc3VwcG9ydCBmb3IgaXRlcmF0ZWVcbiAqIHNob3J0aGFuZHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl9IFthcnJheV0gVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGl0ZXJhdGVlIFRoZSBmdW5jdGlvbiBpbnZva2VkIHBlciBpdGVyYXRpb24uXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIG5ldyBtYXBwZWQgYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGFycmF5TWFwKGFycmF5LCBpdGVyYXRlZSkge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IGFycmF5ID09IG51bGwgPyAwIDogYXJyYXkubGVuZ3RoLFxuICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHJlc3VsdFtpbmRleF0gPSBpdGVyYXRlZShhcnJheVtpbmRleF0sIGluZGV4LCBhcnJheSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhcnJheU1hcDtcbiIsInZhciBlcSA9IHJlcXVpcmUoJy4vZXEnKTtcblxuLyoqXG4gKiBHZXRzIHRoZSBpbmRleCBhdCB3aGljaCB0aGUgYGtleWAgaXMgZm91bmQgaW4gYGFycmF5YCBvZiBrZXktdmFsdWUgcGFpcnMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBpbnNwZWN0LlxuICogQHBhcmFtIHsqfSBrZXkgVGhlIGtleSB0byBzZWFyY2ggZm9yLlxuICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIG1hdGNoZWQgdmFsdWUsIGVsc2UgYC0xYC5cbiAqL1xuZnVuY3Rpb24gYXNzb2NJbmRleE9mKGFycmF5LCBrZXkpIHtcbiAgdmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcbiAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgaWYgKGVxKGFycmF5W2xlbmd0aF1bMF0sIGtleSkpIHtcbiAgICAgIHJldHVybiBsZW5ndGg7XG4gICAgfVxuICB9XG4gIHJldHVybiAtMTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhc3NvY0luZGV4T2Y7XG4iLCJ2YXIgY2FzdFBhdGggPSByZXF1aXJlKCcuL19jYXN0UGF0aCcpLFxuICAgIHRvS2V5ID0gcmVxdWlyZSgnLi9fdG9LZXknKTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5nZXRgIHdpdGhvdXQgc3VwcG9ydCBmb3IgZGVmYXVsdCB2YWx1ZXMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEBwYXJhbSB7QXJyYXl8c3RyaW5nfSBwYXRoIFRoZSBwYXRoIG9mIHRoZSBwcm9wZXJ0eSB0byBnZXQuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgcmVzb2x2ZWQgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIGJhc2VHZXQob2JqZWN0LCBwYXRoKSB7XG4gIHBhdGggPSBjYXN0UGF0aChwYXRoLCBvYmplY3QpO1xuXG4gIHZhciBpbmRleCA9IDAsXG4gICAgICBsZW5ndGggPSBwYXRoLmxlbmd0aDtcblxuICB3aGlsZSAob2JqZWN0ICE9IG51bGwgJiYgaW5kZXggPCBsZW5ndGgpIHtcbiAgICBvYmplY3QgPSBvYmplY3RbdG9LZXkocGF0aFtpbmRleCsrXSldO1xuICB9XG4gIHJldHVybiAoaW5kZXggJiYgaW5kZXggPT0gbGVuZ3RoKSA/IG9iamVjdCA6IHVuZGVmaW5lZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiYXNlR2V0O1xuIiwidmFyIFN5bWJvbCA9IHJlcXVpcmUoJy4vX1N5bWJvbCcpLFxuICAgIGdldFJhd1RhZyA9IHJlcXVpcmUoJy4vX2dldFJhd1RhZycpLFxuICAgIG9iamVjdFRvU3RyaW5nID0gcmVxdWlyZSgnLi9fb2JqZWN0VG9TdHJpbmcnKTtcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIG51bGxUYWcgPSAnW29iamVjdCBOdWxsXScsXG4gICAgdW5kZWZpbmVkVGFnID0gJ1tvYmplY3QgVW5kZWZpbmVkXSc7XG5cbi8qKiBCdWlsdC1pbiB2YWx1ZSByZWZlcmVuY2VzLiAqL1xudmFyIHN5bVRvU3RyaW5nVGFnID0gU3ltYm9sID8gU3ltYm9sLnRvU3RyaW5nVGFnIDogdW5kZWZpbmVkO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBnZXRUYWdgIHdpdGhvdXQgZmFsbGJhY2tzIGZvciBidWdneSBlbnZpcm9ubWVudHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHF1ZXJ5LlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgYHRvU3RyaW5nVGFnYC5cbiAqL1xuZnVuY3Rpb24gYmFzZUdldFRhZyh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkVGFnIDogbnVsbFRhZztcbiAgfVxuICByZXR1cm4gKHN5bVRvU3RyaW5nVGFnICYmIHN5bVRvU3RyaW5nVGFnIGluIE9iamVjdCh2YWx1ZSkpXG4gICAgPyBnZXRSYXdUYWcodmFsdWUpXG4gICAgOiBvYmplY3RUb1N0cmluZyh2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmFzZUdldFRhZztcbiIsInZhciBiYXNlR2V0VGFnID0gcmVxdWlyZSgnLi9fYmFzZUdldFRhZycpLFxuICAgIGlzT2JqZWN0TGlrZSA9IHJlcXVpcmUoJy4vaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBhcmdzVGFnID0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8uaXNBcmd1bWVudHNgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIGBhcmd1bWVudHNgIG9iamVjdCxcbiAqL1xuZnVuY3Rpb24gYmFzZUlzQXJndW1lbnRzKHZhbHVlKSB7XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIGJhc2VHZXRUYWcodmFsdWUpID09IGFyZ3NUYWc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmFzZUlzQXJndW1lbnRzO1xuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKCcuL2lzRnVuY3Rpb24nKSxcbiAgICBpc01hc2tlZCA9IHJlcXVpcmUoJy4vX2lzTWFza2VkJyksXG4gICAgaXNPYmplY3QgPSByZXF1aXJlKCcuL2lzT2JqZWN0JyksXG4gICAgdG9Tb3VyY2UgPSByZXF1aXJlKCcuL190b1NvdXJjZScpO1xuXG4vKipcbiAqIFVzZWQgdG8gbWF0Y2ggYFJlZ0V4cGBcbiAqIFtzeW50YXggY2hhcmFjdGVyc10oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNy4wLyNzZWMtcGF0dGVybnMpLlxuICovXG52YXIgcmVSZWdFeHBDaGFyID0gL1tcXFxcXiQuKis/KClbXFxde318XS9nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgaG9zdCBjb25zdHJ1Y3RvcnMgKFNhZmFyaSkuICovXG52YXIgcmVJc0hvc3RDdG9yID0gL15cXFtvYmplY3QgLis/Q29uc3RydWN0b3JcXF0kLztcblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZSxcbiAgICBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGRlY29tcGlsZWQgc291cmNlIG9mIGZ1bmN0aW9ucy4gKi9cbnZhciBmdW5jVG9TdHJpbmcgPSBmdW5jUHJvdG8udG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBpZiBhIG1ldGhvZCBpcyBuYXRpdmUuICovXG52YXIgcmVJc05hdGl2ZSA9IFJlZ0V4cCgnXicgK1xuICBmdW5jVG9TdHJpbmcuY2FsbChoYXNPd25Qcm9wZXJ0eSkucmVwbGFjZShyZVJlZ0V4cENoYXIsICdcXFxcJCYnKVxuICAucmVwbGFjZSgvaGFzT3duUHJvcGVydHl8KGZ1bmN0aW9uKS4qPyg/PVxcXFxcXCgpfCBmb3IgLis/KD89XFxcXFxcXSkvZywgJyQxLio/JykgKyAnJCdcbik7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8uaXNOYXRpdmVgIHdpdGhvdXQgYmFkIHNoaW0gY2hlY2tzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgbmF0aXZlIGZ1bmN0aW9uLFxuICogIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gYmFzZUlzTmF0aXZlKHZhbHVlKSB7XG4gIGlmICghaXNPYmplY3QodmFsdWUpIHx8IGlzTWFza2VkKHZhbHVlKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgcGF0dGVybiA9IGlzRnVuY3Rpb24odmFsdWUpID8gcmVJc05hdGl2ZSA6IHJlSXNIb3N0Q3RvcjtcbiAgcmV0dXJuIHBhdHRlcm4udGVzdCh0b1NvdXJjZSh2YWx1ZSkpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJhc2VJc05hdGl2ZTtcbiIsInZhciBiYXNlR2V0VGFnID0gcmVxdWlyZSgnLi9fYmFzZUdldFRhZycpLFxuICAgIGlzTGVuZ3RoID0gcmVxdWlyZSgnLi9pc0xlbmd0aCcpLFxuICAgIGlzT2JqZWN0TGlrZSA9IHJlcXVpcmUoJy4vaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBhcmdzVGFnID0gJ1tvYmplY3QgQXJndW1lbnRzXScsXG4gICAgYXJyYXlUYWcgPSAnW29iamVjdCBBcnJheV0nLFxuICAgIGJvb2xUYWcgPSAnW29iamVjdCBCb29sZWFuXScsXG4gICAgZGF0ZVRhZyA9ICdbb2JqZWN0IERhdGVdJyxcbiAgICBlcnJvclRhZyA9ICdbb2JqZWN0IEVycm9yXScsXG4gICAgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXScsXG4gICAgbWFwVGFnID0gJ1tvYmplY3QgTWFwXScsXG4gICAgbnVtYmVyVGFnID0gJ1tvYmplY3QgTnVtYmVyXScsXG4gICAgb2JqZWN0VGFnID0gJ1tvYmplY3QgT2JqZWN0XScsXG4gICAgcmVnZXhwVGFnID0gJ1tvYmplY3QgUmVnRXhwXScsXG4gICAgc2V0VGFnID0gJ1tvYmplY3QgU2V0XScsXG4gICAgc3RyaW5nVGFnID0gJ1tvYmplY3QgU3RyaW5nXScsXG4gICAgd2Vha01hcFRhZyA9ICdbb2JqZWN0IFdlYWtNYXBdJztcblxudmFyIGFycmF5QnVmZmVyVGFnID0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJyxcbiAgICBkYXRhVmlld1RhZyA9ICdbb2JqZWN0IERhdGFWaWV3XScsXG4gICAgZmxvYXQzMlRhZyA9ICdbb2JqZWN0IEZsb2F0MzJBcnJheV0nLFxuICAgIGZsb2F0NjRUYWcgPSAnW29iamVjdCBGbG9hdDY0QXJyYXldJyxcbiAgICBpbnQ4VGFnID0gJ1tvYmplY3QgSW50OEFycmF5XScsXG4gICAgaW50MTZUYWcgPSAnW29iamVjdCBJbnQxNkFycmF5XScsXG4gICAgaW50MzJUYWcgPSAnW29iamVjdCBJbnQzMkFycmF5XScsXG4gICAgdWludDhUYWcgPSAnW29iamVjdCBVaW50OEFycmF5XScsXG4gICAgdWludDhDbGFtcGVkVGFnID0gJ1tvYmplY3QgVWludDhDbGFtcGVkQXJyYXldJyxcbiAgICB1aW50MTZUYWcgPSAnW29iamVjdCBVaW50MTZBcnJheV0nLFxuICAgIHVpbnQzMlRhZyA9ICdbb2JqZWN0IFVpbnQzMkFycmF5XSc7XG5cbi8qKiBVc2VkIHRvIGlkZW50aWZ5IGB0b1N0cmluZ1RhZ2AgdmFsdWVzIG9mIHR5cGVkIGFycmF5cy4gKi9cbnZhciB0eXBlZEFycmF5VGFncyA9IHt9O1xudHlwZWRBcnJheVRhZ3NbZmxvYXQzMlRhZ10gPSB0eXBlZEFycmF5VGFnc1tmbG9hdDY0VGFnXSA9XG50eXBlZEFycmF5VGFnc1tpbnQ4VGFnXSA9IHR5cGVkQXJyYXlUYWdzW2ludDE2VGFnXSA9XG50eXBlZEFycmF5VGFnc1tpbnQzMlRhZ10gPSB0eXBlZEFycmF5VGFnc1t1aW50OFRhZ10gPVxudHlwZWRBcnJheVRhZ3NbdWludDhDbGFtcGVkVGFnXSA9IHR5cGVkQXJyYXlUYWdzW3VpbnQxNlRhZ10gPVxudHlwZWRBcnJheVRhZ3NbdWludDMyVGFnXSA9IHRydWU7XG50eXBlZEFycmF5VGFnc1thcmdzVGFnXSA9IHR5cGVkQXJyYXlUYWdzW2FycmF5VGFnXSA9XG50eXBlZEFycmF5VGFnc1thcnJheUJ1ZmZlclRhZ10gPSB0eXBlZEFycmF5VGFnc1tib29sVGFnXSA9XG50eXBlZEFycmF5VGFnc1tkYXRhVmlld1RhZ10gPSB0eXBlZEFycmF5VGFnc1tkYXRlVGFnXSA9XG50eXBlZEFycmF5VGFnc1tlcnJvclRhZ10gPSB0eXBlZEFycmF5VGFnc1tmdW5jVGFnXSA9XG50eXBlZEFycmF5VGFnc1ttYXBUYWddID0gdHlwZWRBcnJheVRhZ3NbbnVtYmVyVGFnXSA9XG50eXBlZEFycmF5VGFnc1tvYmplY3RUYWddID0gdHlwZWRBcnJheVRhZ3NbcmVnZXhwVGFnXSA9XG50eXBlZEFycmF5VGFnc1tzZXRUYWddID0gdHlwZWRBcnJheVRhZ3Nbc3RyaW5nVGFnXSA9XG50eXBlZEFycmF5VGFnc1t3ZWFrTWFwVGFnXSA9IGZhbHNlO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmlzVHlwZWRBcnJheWAgd2l0aG91dCBOb2RlLmpzIG9wdGltaXphdGlvbnMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB0eXBlZCBhcnJheSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBiYXNlSXNUeXBlZEFycmF5KHZhbHVlKSB7XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmXG4gICAgaXNMZW5ndGgodmFsdWUubGVuZ3RoKSAmJiAhIXR5cGVkQXJyYXlUYWdzW2Jhc2VHZXRUYWcodmFsdWUpXTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiYXNlSXNUeXBlZEFycmF5O1xuIiwidmFyIGlzUHJvdG90eXBlID0gcmVxdWlyZSgnLi9faXNQcm90b3R5cGUnKSxcbiAgICBuYXRpdmVLZXlzID0gcmVxdWlyZSgnLi9fbmF0aXZlS2V5cycpO1xuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmtleXNgIHdoaWNoIGRvZXNuJ3QgdHJlYXQgc3BhcnNlIGFycmF5cyBhcyBkZW5zZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqL1xuZnVuY3Rpb24gYmFzZUtleXMob2JqZWN0KSB7XG4gIGlmICghaXNQcm90b3R5cGUob2JqZWN0KSkge1xuICAgIHJldHVybiBuYXRpdmVLZXlzKG9iamVjdCk7XG4gIH1cbiAgdmFyIHJlc3VsdCA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gT2JqZWN0KG9iamVjdCkpIHtcbiAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIGtleSkgJiYga2V5ICE9ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmFzZUtleXM7XG4iLCIvKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnRpbWVzYCB3aXRob3V0IHN1cHBvcnQgZm9yIGl0ZXJhdGVlIHNob3J0aGFuZHNcbiAqIG9yIG1heCBhcnJheSBsZW5ndGggY2hlY2tzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge251bWJlcn0gbiBUaGUgbnVtYmVyIG9mIHRpbWVzIHRvIGludm9rZSBgaXRlcmF0ZWVgLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gaXRlcmF0ZWUgVGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgYXJyYXkgb2YgcmVzdWx0cy5cbiAqL1xuZnVuY3Rpb24gYmFzZVRpbWVzKG4sIGl0ZXJhdGVlKSB7XG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgcmVzdWx0ID0gQXJyYXkobik7XG5cbiAgd2hpbGUgKCsraW5kZXggPCBuKSB7XG4gICAgcmVzdWx0W2luZGV4XSA9IGl0ZXJhdGVlKGluZGV4KTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJhc2VUaW1lcztcbiIsInZhciBTeW1ib2wgPSByZXF1aXJlKCcuL19TeW1ib2wnKSxcbiAgICBhcnJheU1hcCA9IHJlcXVpcmUoJy4vX2FycmF5TWFwJyksXG4gICAgaXNBcnJheSA9IHJlcXVpcmUoJy4vaXNBcnJheScpLFxuICAgIGlzU3ltYm9sID0gcmVxdWlyZSgnLi9pc1N5bWJvbCcpO1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBJTkZJTklUWSA9IDEgLyAwO1xuXG4vKiogVXNlZCB0byBjb252ZXJ0IHN5bWJvbHMgdG8gcHJpbWl0aXZlcyBhbmQgc3RyaW5ncy4gKi9cbnZhciBzeW1ib2xQcm90byA9IFN5bWJvbCA/IFN5bWJvbC5wcm90b3R5cGUgOiB1bmRlZmluZWQsXG4gICAgc3ltYm9sVG9TdHJpbmcgPSBzeW1ib2xQcm90byA/IHN5bWJvbFByb3RvLnRvU3RyaW5nIDogdW5kZWZpbmVkO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnRvU3RyaW5nYCB3aGljaCBkb2Vzbid0IGNvbnZlcnQgbnVsbGlzaFxuICogdmFsdWVzIHRvIGVtcHR5IHN0cmluZ3MuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHByb2Nlc3MuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGJhc2VUb1N0cmluZyh2YWx1ZSkge1xuICAvLyBFeGl0IGVhcmx5IGZvciBzdHJpbmdzIHRvIGF2b2lkIGEgcGVyZm9ybWFuY2UgaGl0IGluIHNvbWUgZW52aXJvbm1lbnRzLlxuICBpZiAodHlwZW9mIHZhbHVlID09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgIC8vIFJlY3Vyc2l2ZWx5IGNvbnZlcnQgdmFsdWVzIChzdXNjZXB0aWJsZSB0byBjYWxsIHN0YWNrIGxpbWl0cykuXG4gICAgcmV0dXJuIGFycmF5TWFwKHZhbHVlLCBiYXNlVG9TdHJpbmcpICsgJyc7XG4gIH1cbiAgaWYgKGlzU3ltYm9sKHZhbHVlKSkge1xuICAgIHJldHVybiBzeW1ib2xUb1N0cmluZyA/IHN5bWJvbFRvU3RyaW5nLmNhbGwodmFsdWUpIDogJyc7XG4gIH1cbiAgdmFyIHJlc3VsdCA9ICh2YWx1ZSArICcnKTtcbiAgcmV0dXJuIChyZXN1bHQgPT0gJzAnICYmICgxIC8gdmFsdWUpID09IC1JTkZJTklUWSkgPyAnLTAnIDogcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJhc2VUb1N0cmluZztcbiIsIi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8udW5hcnlgIHdpdGhvdXQgc3VwcG9ydCBmb3Igc3RvcmluZyBtZXRhZGF0YS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gY2FwIGFyZ3VtZW50cyBmb3IuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBjYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VVbmFyeShmdW5jKSB7XG4gIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBmdW5jKHZhbHVlKTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiYXNlVW5hcnk7XG4iLCJ2YXIgaXNBcnJheSA9IHJlcXVpcmUoJy4vaXNBcnJheScpLFxuICAgIGlzS2V5ID0gcmVxdWlyZSgnLi9faXNLZXknKSxcbiAgICBzdHJpbmdUb1BhdGggPSByZXF1aXJlKCcuL19zdHJpbmdUb1BhdGgnKSxcbiAgICB0b1N0cmluZyA9IHJlcXVpcmUoJy4vdG9TdHJpbmcnKTtcblxuLyoqXG4gKiBDYXN0cyBgdmFsdWVgIHRvIGEgcGF0aCBhcnJheSBpZiBpdCdzIG5vdCBvbmUuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGluc3BlY3QuXG4gKiBAcGFyYW0ge09iamVjdH0gW29iamVjdF0gVGhlIG9iamVjdCB0byBxdWVyeSBrZXlzIG9uLlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBjYXN0IHByb3BlcnR5IHBhdGggYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGNhc3RQYXRoKHZhbHVlLCBvYmplY3QpIHtcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJldHVybiBpc0tleSh2YWx1ZSwgb2JqZWN0KSA/IFt2YWx1ZV0gOiBzdHJpbmdUb1BhdGgodG9TdHJpbmcodmFsdWUpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYXN0UGF0aDtcbiIsInZhciByb290ID0gcmVxdWlyZSgnLi9fcm9vdCcpO1xuXG4vKiogVXNlZCB0byBkZXRlY3Qgb3ZlcnJlYWNoaW5nIGNvcmUtanMgc2hpbXMuICovXG52YXIgY29yZUpzRGF0YSA9IHJvb3RbJ19fY29yZS1qc19zaGFyZWRfXyddO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNvcmVKc0RhdGE7XG4iLCIvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGdsb2JhbGAgZnJvbSBOb2RlLmpzLiAqL1xudmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbCAmJiBnbG9iYWwuT2JqZWN0ID09PSBPYmplY3QgJiYgZ2xvYmFsO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZyZWVHbG9iYWw7XG4iLCJ2YXIgaXNLZXlhYmxlID0gcmVxdWlyZSgnLi9faXNLZXlhYmxlJyk7XG5cbi8qKlxuICogR2V0cyB0aGUgZGF0YSBmb3IgYG1hcGAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBtYXAgVGhlIG1hcCB0byBxdWVyeS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIHJlZmVyZW5jZSBrZXkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgbWFwIGRhdGEuXG4gKi9cbmZ1bmN0aW9uIGdldE1hcERhdGEobWFwLCBrZXkpIHtcbiAgdmFyIGRhdGEgPSBtYXAuX19kYXRhX187XG4gIHJldHVybiBpc0tleWFibGUoa2V5KVxuICAgID8gZGF0YVt0eXBlb2Yga2V5ID09ICdzdHJpbmcnID8gJ3N0cmluZycgOiAnaGFzaCddXG4gICAgOiBkYXRhLm1hcDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRNYXBEYXRhO1xuIiwidmFyIGJhc2VJc05hdGl2ZSA9IHJlcXVpcmUoJy4vX2Jhc2VJc05hdGl2ZScpLFxuICAgIGdldFZhbHVlID0gcmVxdWlyZSgnLi9fZ2V0VmFsdWUnKTtcblxuLyoqXG4gKiBHZXRzIHRoZSBuYXRpdmUgZnVuY3Rpb24gYXQgYGtleWAgb2YgYG9iamVjdGAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgbWV0aG9kIHRvIGdldC5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBmdW5jdGlvbiBpZiBpdCdzIG5hdGl2ZSwgZWxzZSBgdW5kZWZpbmVkYC5cbiAqL1xuZnVuY3Rpb24gZ2V0TmF0aXZlKG9iamVjdCwga2V5KSB7XG4gIHZhciB2YWx1ZSA9IGdldFZhbHVlKG9iamVjdCwga2V5KTtcbiAgcmV0dXJuIGJhc2VJc05hdGl2ZSh2YWx1ZSkgPyB2YWx1ZSA6IHVuZGVmaW5lZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXROYXRpdmU7XG4iLCJ2YXIgb3ZlckFyZyA9IHJlcXVpcmUoJy4vX292ZXJBcmcnKTtcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgZ2V0UHJvdG90eXBlID0gb3ZlckFyZyhPYmplY3QuZ2V0UHJvdG90eXBlT2YsIE9iamVjdCk7XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0UHJvdG90eXBlO1xuIiwidmFyIFN5bWJvbCA9IHJlcXVpcmUoJy4vX1N5bWJvbCcpO1xuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGVcbiAqIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi83LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgbmF0aXZlT2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgc3ltVG9TdHJpbmdUYWcgPSBTeW1ib2wgPyBTeW1ib2wudG9TdHJpbmdUYWcgOiB1bmRlZmluZWQ7XG5cbi8qKlxuICogQSBzcGVjaWFsaXplZCB2ZXJzaW9uIG9mIGBiYXNlR2V0VGFnYCB3aGljaCBpZ25vcmVzIGBTeW1ib2wudG9TdHJpbmdUYWdgIHZhbHVlcy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSByYXcgYHRvU3RyaW5nVGFnYC5cbiAqL1xuZnVuY3Rpb24gZ2V0UmF3VGFnKHZhbHVlKSB7XG4gIHZhciBpc093biA9IGhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIHN5bVRvU3RyaW5nVGFnKSxcbiAgICAgIHRhZyA9IHZhbHVlW3N5bVRvU3RyaW5nVGFnXTtcblxuICB0cnkge1xuICAgIHZhbHVlW3N5bVRvU3RyaW5nVGFnXSA9IHVuZGVmaW5lZDtcbiAgICB2YXIgdW5tYXNrZWQgPSB0cnVlO1xuICB9IGNhdGNoIChlKSB7fVxuXG4gIHZhciByZXN1bHQgPSBuYXRpdmVPYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgaWYgKHVubWFza2VkKSB7XG4gICAgaWYgKGlzT3duKSB7XG4gICAgICB2YWx1ZVtzeW1Ub1N0cmluZ1RhZ10gPSB0YWc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSB2YWx1ZVtzeW1Ub1N0cmluZ1RhZ107XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0UmF3VGFnO1xuIiwiLyoqXG4gKiBHZXRzIHRoZSB2YWx1ZSBhdCBga2V5YCBvZiBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IFtvYmplY3RdIFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBwcm9wZXJ0eSB2YWx1ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0VmFsdWUob2JqZWN0LCBrZXkpIHtcbiAgcmV0dXJuIG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0VmFsdWU7XG4iLCJ2YXIgbmF0aXZlQ3JlYXRlID0gcmVxdWlyZSgnLi9fbmF0aXZlQ3JlYXRlJyk7XG5cbi8qKlxuICogUmVtb3ZlcyBhbGwga2V5LXZhbHVlIGVudHJpZXMgZnJvbSB0aGUgaGFzaC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQG5hbWUgY2xlYXJcbiAqIEBtZW1iZXJPZiBIYXNoXG4gKi9cbmZ1bmN0aW9uIGhhc2hDbGVhcigpIHtcbiAgdGhpcy5fX2RhdGFfXyA9IG5hdGl2ZUNyZWF0ZSA/IG5hdGl2ZUNyZWF0ZShudWxsKSA6IHt9O1xuICB0aGlzLnNpemUgPSAwO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhc2hDbGVhcjtcbiIsIi8qKlxuICogUmVtb3ZlcyBga2V5YCBhbmQgaXRzIHZhbHVlIGZyb20gdGhlIGhhc2guXG4gKlxuICogQHByaXZhdGVcbiAqIEBuYW1lIGRlbGV0ZVxuICogQG1lbWJlck9mIEhhc2hcbiAqIEBwYXJhbSB7T2JqZWN0fSBoYXNoIFRoZSBoYXNoIHRvIG1vZGlmeS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgdmFsdWUgdG8gcmVtb3ZlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBlbnRyeSB3YXMgcmVtb3ZlZCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBoYXNoRGVsZXRlKGtleSkge1xuICB2YXIgcmVzdWx0ID0gdGhpcy5oYXMoa2V5KSAmJiBkZWxldGUgdGhpcy5fX2RhdGFfX1trZXldO1xuICB0aGlzLnNpemUgLT0gcmVzdWx0ID8gMSA6IDA7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaGFzaERlbGV0ZTtcbiIsInZhciBuYXRpdmVDcmVhdGUgPSByZXF1aXJlKCcuL19uYXRpdmVDcmVhdGUnKTtcblxuLyoqIFVzZWQgdG8gc3RhbmQtaW4gZm9yIGB1bmRlZmluZWRgIGhhc2ggdmFsdWVzLiAqL1xudmFyIEhBU0hfVU5ERUZJTkVEID0gJ19fbG9kYXNoX2hhc2hfdW5kZWZpbmVkX18nO1xuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIEdldHMgdGhlIGhhc2ggdmFsdWUgZm9yIGBrZXlgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbmFtZSBnZXRcbiAqIEBtZW1iZXJPZiBIYXNoXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHZhbHVlIHRvIGdldC5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBlbnRyeSB2YWx1ZS5cbiAqL1xuZnVuY3Rpb24gaGFzaEdldChrZXkpIHtcbiAgdmFyIGRhdGEgPSB0aGlzLl9fZGF0YV9fO1xuICBpZiAobmF0aXZlQ3JlYXRlKSB7XG4gICAgdmFyIHJlc3VsdCA9IGRhdGFba2V5XTtcbiAgICByZXR1cm4gcmVzdWx0ID09PSBIQVNIX1VOREVGSU5FRCA/IHVuZGVmaW5lZCA6IHJlc3VsdDtcbiAgfVxuICByZXR1cm4gaGFzT3duUHJvcGVydHkuY2FsbChkYXRhLCBrZXkpID8gZGF0YVtrZXldIDogdW5kZWZpbmVkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhc2hHZXQ7XG4iLCJ2YXIgbmF0aXZlQ3JlYXRlID0gcmVxdWlyZSgnLi9fbmF0aXZlQ3JlYXRlJyk7XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgaGFzaCB2YWx1ZSBmb3IgYGtleWAgZXhpc3RzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbmFtZSBoYXNcbiAqIEBtZW1iZXJPZiBIYXNoXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIGVudHJ5IHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGFuIGVudHJ5IGZvciBga2V5YCBleGlzdHMsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaGFzaEhhcyhrZXkpIHtcbiAgdmFyIGRhdGEgPSB0aGlzLl9fZGF0YV9fO1xuICByZXR1cm4gbmF0aXZlQ3JlYXRlID8gKGRhdGFba2V5XSAhPT0gdW5kZWZpbmVkKSA6IGhhc093blByb3BlcnR5LmNhbGwoZGF0YSwga2V5KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYXNoSGFzO1xuIiwidmFyIG5hdGl2ZUNyZWF0ZSA9IHJlcXVpcmUoJy4vX25hdGl2ZUNyZWF0ZScpO1xuXG4vKiogVXNlZCB0byBzdGFuZC1pbiBmb3IgYHVuZGVmaW5lZGAgaGFzaCB2YWx1ZXMuICovXG52YXIgSEFTSF9VTkRFRklORUQgPSAnX19sb2Rhc2hfaGFzaF91bmRlZmluZWRfXyc7XG5cbi8qKlxuICogU2V0cyB0aGUgaGFzaCBga2V5YCB0byBgdmFsdWVgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbmFtZSBzZXRcbiAqIEBtZW1iZXJPZiBIYXNoXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHZhbHVlIHRvIHNldC5cbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHNldC5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGhhc2ggaW5zdGFuY2UuXG4gKi9cbmZ1bmN0aW9uIGhhc2hTZXQoa2V5LCB2YWx1ZSkge1xuICB2YXIgZGF0YSA9IHRoaXMuX19kYXRhX187XG4gIHRoaXMuc2l6ZSArPSB0aGlzLmhhcyhrZXkpID8gMCA6IDE7XG4gIGRhdGFba2V5XSA9IChuYXRpdmVDcmVhdGUgJiYgdmFsdWUgPT09IHVuZGVmaW5lZCkgPyBIQVNIX1VOREVGSU5FRCA6IHZhbHVlO1xuICByZXR1cm4gdGhpcztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoYXNoU2V0O1xuIiwiLyoqIFVzZWQgYXMgcmVmZXJlbmNlcyBmb3IgdmFyaW91cyBgTnVtYmVyYCBjb25zdGFudHMuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCB1bnNpZ25lZCBpbnRlZ2VyIHZhbHVlcy4gKi9cbnZhciByZUlzVWludCA9IC9eKD86MHxbMS05XVxcZCopJC87XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGluZGV4LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoPU1BWF9TQUZFX0lOVEVHRVJdIFRoZSB1cHBlciBib3VuZHMgb2YgYSB2YWxpZCBpbmRleC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgaW5kZXgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJbmRleCh2YWx1ZSwgbGVuZ3RoKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICBsZW5ndGggPSBsZW5ndGggPT0gbnVsbCA/IE1BWF9TQUZFX0lOVEVHRVIgOiBsZW5ndGg7XG5cbiAgcmV0dXJuICEhbGVuZ3RoICYmXG4gICAgKHR5cGUgPT0gJ251bWJlcicgfHxcbiAgICAgICh0eXBlICE9ICdzeW1ib2wnICYmIHJlSXNVaW50LnRlc3QodmFsdWUpKSkgJiZcbiAgICAgICAgKHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPCBsZW5ndGgpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzSW5kZXg7XG4iLCJ2YXIgaXNBcnJheSA9IHJlcXVpcmUoJy4vaXNBcnJheScpLFxuICAgIGlzU3ltYm9sID0gcmVxdWlyZSgnLi9pc1N5bWJvbCcpO1xuXG4vKiogVXNlZCB0byBtYXRjaCBwcm9wZXJ0eSBuYW1lcyB3aXRoaW4gcHJvcGVydHkgcGF0aHMuICovXG52YXIgcmVJc0RlZXBQcm9wID0gL1xcLnxcXFsoPzpbXltcXF1dKnwoW1wiJ10pKD86KD8hXFwxKVteXFxcXF18XFxcXC4pKj9cXDEpXFxdLyxcbiAgICByZUlzUGxhaW5Qcm9wID0gL15cXHcqJC87XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBwcm9wZXJ0eSBuYW1lIGFuZCBub3QgYSBwcm9wZXJ0eSBwYXRoLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb2JqZWN0XSBUaGUgb2JqZWN0IHRvIHF1ZXJ5IGtleXMgb24uXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHByb3BlcnR5IG5hbWUsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNLZXkodmFsdWUsIG9iamVjdCkge1xuICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIGlmICh0eXBlID09ICdudW1iZXInIHx8IHR5cGUgPT0gJ3N5bWJvbCcgfHwgdHlwZSA9PSAnYm9vbGVhbicgfHxcbiAgICAgIHZhbHVlID09IG51bGwgfHwgaXNTeW1ib2wodmFsdWUpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIHJlSXNQbGFpblByb3AudGVzdCh2YWx1ZSkgfHwgIXJlSXNEZWVwUHJvcC50ZXN0KHZhbHVlKSB8fFxuICAgIChvYmplY3QgIT0gbnVsbCAmJiB2YWx1ZSBpbiBPYmplY3Qob2JqZWN0KSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNLZXk7XG4iLCIvKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHN1aXRhYmxlIGZvciB1c2UgYXMgdW5pcXVlIG9iamVjdCBrZXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgc3VpdGFibGUsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNLZXlhYmxlKHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gKHR5cGUgPT0gJ3N0cmluZycgfHwgdHlwZSA9PSAnbnVtYmVyJyB8fCB0eXBlID09ICdzeW1ib2wnIHx8IHR5cGUgPT0gJ2Jvb2xlYW4nKVxuICAgID8gKHZhbHVlICE9PSAnX19wcm90b19fJylcbiAgICA6ICh2YWx1ZSA9PT0gbnVsbCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNLZXlhYmxlO1xuIiwidmFyIGNvcmVKc0RhdGEgPSByZXF1aXJlKCcuL19jb3JlSnNEYXRhJyk7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBtZXRob2RzIG1hc3F1ZXJhZGluZyBhcyBuYXRpdmUuICovXG52YXIgbWFza1NyY0tleSA9IChmdW5jdGlvbigpIHtcbiAgdmFyIHVpZCA9IC9bXi5dKyQvLmV4ZWMoY29yZUpzRGF0YSAmJiBjb3JlSnNEYXRhLmtleXMgJiYgY29yZUpzRGF0YS5rZXlzLklFX1BST1RPIHx8ICcnKTtcbiAgcmV0dXJuIHVpZCA/ICgnU3ltYm9sKHNyYylfMS4nICsgdWlkKSA6ICcnO1xufSgpKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYGZ1bmNgIGhhcyBpdHMgc291cmNlIG1hc2tlZC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYGZ1bmNgIGlzIG1hc2tlZCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc01hc2tlZChmdW5jKSB7XG4gIHJldHVybiAhIW1hc2tTcmNLZXkgJiYgKG1hc2tTcmNLZXkgaW4gZnVuYyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNNYXNrZWQ7XG4iLCIvKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGxpa2VseSBhIHByb3RvdHlwZSBvYmplY3QuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwcm90b3R5cGUsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNQcm90b3R5cGUodmFsdWUpIHtcbiAgdmFyIEN0b3IgPSB2YWx1ZSAmJiB2YWx1ZS5jb25zdHJ1Y3RvcixcbiAgICAgIHByb3RvID0gKHR5cGVvZiBDdG9yID09ICdmdW5jdGlvbicgJiYgQ3Rvci5wcm90b3R5cGUpIHx8IG9iamVjdFByb3RvO1xuXG4gIHJldHVybiB2YWx1ZSA9PT0gcHJvdG87XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNQcm90b3R5cGU7XG4iLCIvKipcbiAqIFJlbW92ZXMgYWxsIGtleS12YWx1ZSBlbnRyaWVzIGZyb20gdGhlIGxpc3QgY2FjaGUuXG4gKlxuICogQHByaXZhdGVcbiAqIEBuYW1lIGNsZWFyXG4gKiBAbWVtYmVyT2YgTGlzdENhY2hlXG4gKi9cbmZ1bmN0aW9uIGxpc3RDYWNoZUNsZWFyKCkge1xuICB0aGlzLl9fZGF0YV9fID0gW107XG4gIHRoaXMuc2l6ZSA9IDA7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlzdENhY2hlQ2xlYXI7XG4iLCJ2YXIgYXNzb2NJbmRleE9mID0gcmVxdWlyZSgnLi9fYXNzb2NJbmRleE9mJyk7XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBhcnJheVByb3RvID0gQXJyYXkucHJvdG90eXBlO1xuXG4vKiogQnVpbHQtaW4gdmFsdWUgcmVmZXJlbmNlcy4gKi9cbnZhciBzcGxpY2UgPSBhcnJheVByb3RvLnNwbGljZTtcblxuLyoqXG4gKiBSZW1vdmVzIGBrZXlgIGFuZCBpdHMgdmFsdWUgZnJvbSB0aGUgbGlzdCBjYWNoZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQG5hbWUgZGVsZXRlXG4gKiBAbWVtYmVyT2YgTGlzdENhY2hlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHZhbHVlIHRvIHJlbW92ZS5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgZW50cnkgd2FzIHJlbW92ZWQsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gbGlzdENhY2hlRGVsZXRlKGtleSkge1xuICB2YXIgZGF0YSA9IHRoaXMuX19kYXRhX18sXG4gICAgICBpbmRleCA9IGFzc29jSW5kZXhPZihkYXRhLCBrZXkpO1xuXG4gIGlmIChpbmRleCA8IDApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIGxhc3RJbmRleCA9IGRhdGEubGVuZ3RoIC0gMTtcbiAgaWYgKGluZGV4ID09IGxhc3RJbmRleCkge1xuICAgIGRhdGEucG9wKCk7XG4gIH0gZWxzZSB7XG4gICAgc3BsaWNlLmNhbGwoZGF0YSwgaW5kZXgsIDEpO1xuICB9XG4gIC0tdGhpcy5zaXplO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaXN0Q2FjaGVEZWxldGU7XG4iLCJ2YXIgYXNzb2NJbmRleE9mID0gcmVxdWlyZSgnLi9fYXNzb2NJbmRleE9mJyk7XG5cbi8qKlxuICogR2V0cyB0aGUgbGlzdCBjYWNoZSB2YWx1ZSBmb3IgYGtleWAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBuYW1lIGdldFxuICogQG1lbWJlck9mIExpc3RDYWNoZVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSB2YWx1ZSB0byBnZXQuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgZW50cnkgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIGxpc3RDYWNoZUdldChrZXkpIHtcbiAgdmFyIGRhdGEgPSB0aGlzLl9fZGF0YV9fLFxuICAgICAgaW5kZXggPSBhc3NvY0luZGV4T2YoZGF0YSwga2V5KTtcblxuICByZXR1cm4gaW5kZXggPCAwID8gdW5kZWZpbmVkIDogZGF0YVtpbmRleF1bMV07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlzdENhY2hlR2V0O1xuIiwidmFyIGFzc29jSW5kZXhPZiA9IHJlcXVpcmUoJy4vX2Fzc29jSW5kZXhPZicpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBhIGxpc3QgY2FjaGUgdmFsdWUgZm9yIGBrZXlgIGV4aXN0cy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQG5hbWUgaGFzXG4gKiBAbWVtYmVyT2YgTGlzdENhY2hlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIGVudHJ5IHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGFuIGVudHJ5IGZvciBga2V5YCBleGlzdHMsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gbGlzdENhY2hlSGFzKGtleSkge1xuICByZXR1cm4gYXNzb2NJbmRleE9mKHRoaXMuX19kYXRhX18sIGtleSkgPiAtMTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaXN0Q2FjaGVIYXM7XG4iLCJ2YXIgYXNzb2NJbmRleE9mID0gcmVxdWlyZSgnLi9fYXNzb2NJbmRleE9mJyk7XG5cbi8qKlxuICogU2V0cyB0aGUgbGlzdCBjYWNoZSBga2V5YCB0byBgdmFsdWVgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbmFtZSBzZXRcbiAqIEBtZW1iZXJPZiBMaXN0Q2FjaGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgdmFsdWUgdG8gc2V0LlxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2V0LlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgbGlzdCBjYWNoZSBpbnN0YW5jZS5cbiAqL1xuZnVuY3Rpb24gbGlzdENhY2hlU2V0KGtleSwgdmFsdWUpIHtcbiAgdmFyIGRhdGEgPSB0aGlzLl9fZGF0YV9fLFxuICAgICAgaW5kZXggPSBhc3NvY0luZGV4T2YoZGF0YSwga2V5KTtcblxuICBpZiAoaW5kZXggPCAwKSB7XG4gICAgKyt0aGlzLnNpemU7XG4gICAgZGF0YS5wdXNoKFtrZXksIHZhbHVlXSk7XG4gIH0gZWxzZSB7XG4gICAgZGF0YVtpbmRleF1bMV0gPSB2YWx1ZTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaXN0Q2FjaGVTZXQ7XG4iLCJ2YXIgSGFzaCA9IHJlcXVpcmUoJy4vX0hhc2gnKSxcbiAgICBMaXN0Q2FjaGUgPSByZXF1aXJlKCcuL19MaXN0Q2FjaGUnKSxcbiAgICBNYXAgPSByZXF1aXJlKCcuL19NYXAnKTtcblxuLyoqXG4gKiBSZW1vdmVzIGFsbCBrZXktdmFsdWUgZW50cmllcyBmcm9tIHRoZSBtYXAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBuYW1lIGNsZWFyXG4gKiBAbWVtYmVyT2YgTWFwQ2FjaGVcbiAqL1xuZnVuY3Rpb24gbWFwQ2FjaGVDbGVhcigpIHtcbiAgdGhpcy5zaXplID0gMDtcbiAgdGhpcy5fX2RhdGFfXyA9IHtcbiAgICAnaGFzaCc6IG5ldyBIYXNoLFxuICAgICdtYXAnOiBuZXcgKE1hcCB8fCBMaXN0Q2FjaGUpLFxuICAgICdzdHJpbmcnOiBuZXcgSGFzaFxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1hcENhY2hlQ2xlYXI7XG4iLCJ2YXIgZ2V0TWFwRGF0YSA9IHJlcXVpcmUoJy4vX2dldE1hcERhdGEnKTtcblxuLyoqXG4gKiBSZW1vdmVzIGBrZXlgIGFuZCBpdHMgdmFsdWUgZnJvbSB0aGUgbWFwLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbmFtZSBkZWxldGVcbiAqIEBtZW1iZXJPZiBNYXBDYWNoZVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSB2YWx1ZSB0byByZW1vdmUuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGVudHJ5IHdhcyByZW1vdmVkLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIG1hcENhY2hlRGVsZXRlKGtleSkge1xuICB2YXIgcmVzdWx0ID0gZ2V0TWFwRGF0YSh0aGlzLCBrZXkpWydkZWxldGUnXShrZXkpO1xuICB0aGlzLnNpemUgLT0gcmVzdWx0ID8gMSA6IDA7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWFwQ2FjaGVEZWxldGU7XG4iLCJ2YXIgZ2V0TWFwRGF0YSA9IHJlcXVpcmUoJy4vX2dldE1hcERhdGEnKTtcblxuLyoqXG4gKiBHZXRzIHRoZSBtYXAgdmFsdWUgZm9yIGBrZXlgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAbmFtZSBnZXRcbiAqIEBtZW1iZXJPZiBNYXBDYWNoZVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSB2YWx1ZSB0byBnZXQuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgZW50cnkgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIG1hcENhY2hlR2V0KGtleSkge1xuICByZXR1cm4gZ2V0TWFwRGF0YSh0aGlzLCBrZXkpLmdldChrZXkpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1hcENhY2hlR2V0O1xuIiwidmFyIGdldE1hcERhdGEgPSByZXF1aXJlKCcuL19nZXRNYXBEYXRhJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgbWFwIHZhbHVlIGZvciBga2V5YCBleGlzdHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBuYW1lIGhhc1xuICogQG1lbWJlck9mIE1hcENhY2hlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIGVudHJ5IHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGFuIGVudHJ5IGZvciBga2V5YCBleGlzdHMsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gbWFwQ2FjaGVIYXMoa2V5KSB7XG4gIHJldHVybiBnZXRNYXBEYXRhKHRoaXMsIGtleSkuaGFzKGtleSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWFwQ2FjaGVIYXM7XG4iLCJ2YXIgZ2V0TWFwRGF0YSA9IHJlcXVpcmUoJy4vX2dldE1hcERhdGEnKTtcblxuLyoqXG4gKiBTZXRzIHRoZSBtYXAgYGtleWAgdG8gYHZhbHVlYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQG5hbWUgc2V0XG4gKiBAbWVtYmVyT2YgTWFwQ2FjaGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgdmFsdWUgdG8gc2V0LlxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2V0LlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgbWFwIGNhY2hlIGluc3RhbmNlLlxuICovXG5mdW5jdGlvbiBtYXBDYWNoZVNldChrZXksIHZhbHVlKSB7XG4gIHZhciBkYXRhID0gZ2V0TWFwRGF0YSh0aGlzLCBrZXkpLFxuICAgICAgc2l6ZSA9IGRhdGEuc2l6ZTtcblxuICBkYXRhLnNldChrZXksIHZhbHVlKTtcbiAgdGhpcy5zaXplICs9IGRhdGEuc2l6ZSA9PSBzaXplID8gMCA6IDE7XG4gIHJldHVybiB0aGlzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1hcENhY2hlU2V0O1xuIiwidmFyIG1lbW9pemUgPSByZXF1aXJlKCcuL21lbW9pemUnKTtcblxuLyoqIFVzZWQgYXMgdGhlIG1heGltdW0gbWVtb2l6ZSBjYWNoZSBzaXplLiAqL1xudmFyIE1BWF9NRU1PSVpFX1NJWkUgPSA1MDA7XG5cbi8qKlxuICogQSBzcGVjaWFsaXplZCB2ZXJzaW9uIG9mIGBfLm1lbW9pemVgIHdoaWNoIGNsZWFycyB0aGUgbWVtb2l6ZWQgZnVuY3Rpb24nc1xuICogY2FjaGUgd2hlbiBpdCBleGNlZWRzIGBNQVhfTUVNT0laRV9TSVpFYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gaGF2ZSBpdHMgb3V0cHV0IG1lbW9pemVkLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgbWVtb2l6ZWQgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIG1lbW9pemVDYXBwZWQoZnVuYykge1xuICB2YXIgcmVzdWx0ID0gbWVtb2l6ZShmdW5jLCBmdW5jdGlvbihrZXkpIHtcbiAgICBpZiAoY2FjaGUuc2l6ZSA9PT0gTUFYX01FTU9JWkVfU0laRSkge1xuICAgICAgY2FjaGUuY2xlYXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIGtleTtcbiAgfSk7XG5cbiAgdmFyIGNhY2hlID0gcmVzdWx0LmNhY2hlO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1lbW9pemVDYXBwZWQ7XG4iLCJ2YXIgZ2V0TmF0aXZlID0gcmVxdWlyZSgnLi9fZ2V0TmF0aXZlJyk7XG5cbi8qIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIHRoYXQgYXJlIHZlcmlmaWVkIHRvIGJlIG5hdGl2ZS4gKi9cbnZhciBuYXRpdmVDcmVhdGUgPSBnZXROYXRpdmUoT2JqZWN0LCAnY3JlYXRlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gbmF0aXZlQ3JlYXRlO1xuIiwidmFyIG92ZXJBcmcgPSByZXF1aXJlKCcuL19vdmVyQXJnJyk7XG5cbi8qIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVLZXlzID0gb3ZlckFyZyhPYmplY3Qua2V5cywgT2JqZWN0KTtcblxubW9kdWxlLmV4cG9ydHMgPSBuYXRpdmVLZXlzO1xuIiwidmFyIGZyZWVHbG9iYWwgPSByZXF1aXJlKCcuL19mcmVlR2xvYmFsJyk7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZXhwb3J0c2AuICovXG52YXIgZnJlZUV4cG9ydHMgPSB0eXBlb2YgZXhwb3J0cyA9PSAnb2JqZWN0JyAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlICYmIGV4cG9ydHM7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cbnZhciBmcmVlTW9kdWxlID0gZnJlZUV4cG9ydHMgJiYgdHlwZW9mIG1vZHVsZSA9PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSAmJiBtb2R1bGU7XG5cbi8qKiBEZXRlY3QgdGhlIHBvcHVsYXIgQ29tbW9uSlMgZXh0ZW5zaW9uIGBtb2R1bGUuZXhwb3J0c2AuICovXG52YXIgbW9kdWxlRXhwb3J0cyA9IGZyZWVNb2R1bGUgJiYgZnJlZU1vZHVsZS5leHBvcnRzID09PSBmcmVlRXhwb3J0cztcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBwcm9jZXNzYCBmcm9tIE5vZGUuanMuICovXG52YXIgZnJlZVByb2Nlc3MgPSBtb2R1bGVFeHBvcnRzICYmIGZyZWVHbG9iYWwucHJvY2VzcztcblxuLyoqIFVzZWQgdG8gYWNjZXNzIGZhc3RlciBOb2RlLmpzIGhlbHBlcnMuICovXG52YXIgbm9kZVV0aWwgPSAoZnVuY3Rpb24oKSB7XG4gIHRyeSB7XG4gICAgLy8gVXNlIGB1dGlsLnR5cGVzYCBmb3IgTm9kZS5qcyAxMCsuXG4gICAgdmFyIHR5cGVzID0gZnJlZU1vZHVsZSAmJiBmcmVlTW9kdWxlLnJlcXVpcmUgJiYgZnJlZU1vZHVsZS5yZXF1aXJlKCd1dGlsJykudHlwZXM7XG5cbiAgICBpZiAodHlwZXMpIHtcbiAgICAgIHJldHVybiB0eXBlcztcbiAgICB9XG5cbiAgICAvLyBMZWdhY3kgYHByb2Nlc3MuYmluZGluZygndXRpbCcpYCBmb3IgTm9kZS5qcyA8IDEwLlxuICAgIHJldHVybiBmcmVlUHJvY2VzcyAmJiBmcmVlUHJvY2Vzcy5iaW5kaW5nICYmIGZyZWVQcm9jZXNzLmJpbmRpbmcoJ3V0aWwnKTtcbiAgfSBjYXRjaCAoZSkge31cbn0oKSk7XG5cbm1vZHVsZS5leHBvcnRzID0gbm9kZVV0aWw7XG4iLCIvKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGVcbiAqIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi83LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgbmF0aXZlT2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGEgc3RyaW5nIHVzaW5nIGBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGNvbnZlcnRlZCBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKHZhbHVlKSB7XG4gIHJldHVybiBuYXRpdmVPYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBvYmplY3RUb1N0cmluZztcbiIsIi8qKlxuICogQ3JlYXRlcyBhIHVuYXJ5IGZ1bmN0aW9uIHRoYXQgaW52b2tlcyBgZnVuY2Agd2l0aCBpdHMgYXJndW1lbnQgdHJhbnNmb3JtZWQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHdyYXAuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSB0cmFuc2Zvcm0gVGhlIGFyZ3VtZW50IHRyYW5zZm9ybS5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBvdmVyQXJnKGZ1bmMsIHRyYW5zZm9ybSkge1xuICByZXR1cm4gZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIGZ1bmModHJhbnNmb3JtKGFyZykpO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG92ZXJBcmc7XG4iLCJ2YXIgZnJlZUdsb2JhbCA9IHJlcXVpcmUoJy4vX2ZyZWVHbG9iYWwnKTtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBzZWxmYC4gKi9cbnZhciBmcmVlU2VsZiA9IHR5cGVvZiBzZWxmID09ICdvYmplY3QnICYmIHNlbGYgJiYgc2VsZi5PYmplY3QgPT09IE9iamVjdCAmJiBzZWxmO1xuXG4vKiogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC4gKi9cbnZhciByb290ID0gZnJlZUdsb2JhbCB8fCBmcmVlU2VsZiB8fCBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJvb3Q7XG4iLCJ2YXIgbWVtb2l6ZUNhcHBlZCA9IHJlcXVpcmUoJy4vX21lbW9pemVDYXBwZWQnKTtcblxuLyoqIFVzZWQgdG8gbWF0Y2ggcHJvcGVydHkgbmFtZXMgd2l0aGluIHByb3BlcnR5IHBhdGhzLiAqL1xudmFyIHJlUHJvcE5hbWUgPSAvW14uW1xcXV0rfFxcWyg/OigtP1xcZCsoPzpcXC5cXGQrKT8pfChbXCInXSkoKD86KD8hXFwyKVteXFxcXF18XFxcXC4pKj8pXFwyKVxcXXwoPz0oPzpcXC58XFxbXFxdKSg/OlxcLnxcXFtcXF18JCkpL2c7XG5cbi8qKiBVc2VkIHRvIG1hdGNoIGJhY2tzbGFzaGVzIGluIHByb3BlcnR5IHBhdGhzLiAqL1xudmFyIHJlRXNjYXBlQ2hhciA9IC9cXFxcKFxcXFwpPy9nO1xuXG4vKipcbiAqIENvbnZlcnRzIGBzdHJpbmdgIHRvIGEgcHJvcGVydHkgcGF0aCBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IHN0cmluZyBUaGUgc3RyaW5nIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIHByb3BlcnR5IHBhdGggYXJyYXkuXG4gKi9cbnZhciBzdHJpbmdUb1BhdGggPSBtZW1vaXplQ2FwcGVkKGZ1bmN0aW9uKHN0cmluZykge1xuICB2YXIgcmVzdWx0ID0gW107XG4gIGlmIChzdHJpbmcuY2hhckNvZGVBdCgwKSA9PT0gNDYgLyogLiAqLykge1xuICAgIHJlc3VsdC5wdXNoKCcnKTtcbiAgfVxuICBzdHJpbmcucmVwbGFjZShyZVByb3BOYW1lLCBmdW5jdGlvbihtYXRjaCwgbnVtYmVyLCBxdW90ZSwgc3ViU3RyaW5nKSB7XG4gICAgcmVzdWx0LnB1c2gocXVvdGUgPyBzdWJTdHJpbmcucmVwbGFjZShyZUVzY2FwZUNoYXIsICckMScpIDogKG51bWJlciB8fCBtYXRjaCkpO1xuICB9KTtcbiAgcmV0dXJuIHJlc3VsdDtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN0cmluZ1RvUGF0aDtcbiIsInZhciBpc1N5bWJvbCA9IHJlcXVpcmUoJy4vaXNTeW1ib2wnKTtcblxuLyoqIFVzZWQgYXMgcmVmZXJlbmNlcyBmb3IgdmFyaW91cyBgTnVtYmVyYCBjb25zdGFudHMuICovXG52YXIgSU5GSU5JVFkgPSAxIC8gMDtcblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGEgc3RyaW5nIGtleSBpZiBpdCdzIG5vdCBhIHN0cmluZyBvciBzeW1ib2wuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGluc3BlY3QuXG4gKiBAcmV0dXJucyB7c3RyaW5nfHN5bWJvbH0gUmV0dXJucyB0aGUga2V5LlxuICovXG5mdW5jdGlvbiB0b0tleSh2YWx1ZSkge1xuICBpZiAodHlwZW9mIHZhbHVlID09ICdzdHJpbmcnIHx8IGlzU3ltYm9sKHZhbHVlKSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICB2YXIgcmVzdWx0ID0gKHZhbHVlICsgJycpO1xuICByZXR1cm4gKHJlc3VsdCA9PSAnMCcgJiYgKDEgLyB2YWx1ZSkgPT0gLUlORklOSVRZKSA/ICctMCcgOiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdG9LZXk7XG4iLCIvKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgZnVuY1Byb3RvID0gRnVuY3Rpb24ucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byByZXNvbHZlIHRoZSBkZWNvbXBpbGVkIHNvdXJjZSBvZiBmdW5jdGlvbnMuICovXG52YXIgZnVuY1RvU3RyaW5nID0gZnVuY1Byb3RvLnRvU3RyaW5nO1xuXG4vKipcbiAqIENvbnZlcnRzIGBmdW5jYCB0byBpdHMgc291cmNlIGNvZGUuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBzb3VyY2UgY29kZS5cbiAqL1xuZnVuY3Rpb24gdG9Tb3VyY2UoZnVuYykge1xuICBpZiAoZnVuYyAhPSBudWxsKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBmdW5jVG9TdHJpbmcuY2FsbChmdW5jKTtcbiAgICB9IGNhdGNoIChlKSB7fVxuICAgIHRyeSB7XG4gICAgICByZXR1cm4gKGZ1bmMgKyAnJyk7XG4gICAgfSBjYXRjaCAoZSkge31cbiAgfVxuICByZXR1cm4gJyc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdG9Tb3VyY2U7XG4iLCIvKipcbiAqIFBlcmZvcm1zIGFcbiAqIFtgU2FtZVZhbHVlWmVyb2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzcuMC8jc2VjLXNhbWV2YWx1ZXplcm8pXG4gKiBjb21wYXJpc29uIGJldHdlZW4gdHdvIHZhbHVlcyB0byBkZXRlcm1pbmUgaWYgdGhleSBhcmUgZXF1aXZhbGVudC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMC4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEBwYXJhbSB7Kn0gb3RoZXIgVGhlIG90aGVyIHZhbHVlIHRvIGNvbXBhcmUuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlcyBhcmUgZXF1aXZhbGVudCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgb2JqZWN0ID0geyAnYSc6IDEgfTtcbiAqIHZhciBvdGhlciA9IHsgJ2EnOiAxIH07XG4gKlxuICogXy5lcShvYmplY3QsIG9iamVjdCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5lcShvYmplY3QsIG90aGVyKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5lcSgnYScsICdhJyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5lcSgnYScsIE9iamVjdCgnYScpKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5lcShOYU4sIE5hTik7XG4gKiAvLyA9PiB0cnVlXG4gKi9cbmZ1bmN0aW9uIGVxKHZhbHVlLCBvdGhlcikge1xuICByZXR1cm4gdmFsdWUgPT09IG90aGVyIHx8ICh2YWx1ZSAhPT0gdmFsdWUgJiYgb3RoZXIgIT09IG90aGVyKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBlcTtcbiIsInZhciBiYXNlR2V0ID0gcmVxdWlyZSgnLi9fYmFzZUdldCcpO1xuXG4vKipcbiAqIEdldHMgdGhlIHZhbHVlIGF0IGBwYXRoYCBvZiBgb2JqZWN0YC4gSWYgdGhlIHJlc29sdmVkIHZhbHVlIGlzXG4gKiBgdW5kZWZpbmVkYCwgdGhlIGBkZWZhdWx0VmFsdWVgIGlzIHJldHVybmVkIGluIGl0cyBwbGFjZS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDMuNy4wXG4gKiBAY2F0ZWdvcnkgT2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcGFyYW0ge0FycmF5fHN0cmluZ30gcGF0aCBUaGUgcGF0aCBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHBhcmFtIHsqfSBbZGVmYXVsdFZhbHVlXSBUaGUgdmFsdWUgcmV0dXJuZWQgZm9yIGB1bmRlZmluZWRgIHJlc29sdmVkIHZhbHVlcy5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSByZXNvbHZlZCB2YWx1ZS5cbiAqIEBleGFtcGxlXG4gKlxuICogdmFyIG9iamVjdCA9IHsgJ2EnOiBbeyAnYic6IHsgJ2MnOiAzIH0gfV0gfTtcbiAqXG4gKiBfLmdldChvYmplY3QsICdhWzBdLmIuYycpO1xuICogLy8gPT4gM1xuICpcbiAqIF8uZ2V0KG9iamVjdCwgWydhJywgJzAnLCAnYicsICdjJ10pO1xuICogLy8gPT4gM1xuICpcbiAqIF8uZ2V0KG9iamVjdCwgJ2EuYi5jJywgJ2RlZmF1bHQnKTtcbiAqIC8vID0+ICdkZWZhdWx0J1xuICovXG5mdW5jdGlvbiBnZXQob2JqZWN0LCBwYXRoLCBkZWZhdWx0VmFsdWUpIHtcbiAgdmFyIHJlc3VsdCA9IG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogYmFzZUdldChvYmplY3QsIHBhdGgpO1xuICByZXR1cm4gcmVzdWx0ID09PSB1bmRlZmluZWQgPyBkZWZhdWx0VmFsdWUgOiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0O1xuIiwidmFyIGJhc2VJc0FyZ3VtZW50cyA9IHJlcXVpcmUoJy4vX2Jhc2VJc0FyZ3VtZW50cycpLFxuICAgIGlzT2JqZWN0TGlrZSA9IHJlcXVpcmUoJy4vaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKiBCdWlsdC1pbiB2YWx1ZSByZWZlcmVuY2VzLiAqL1xudmFyIHByb3BlcnR5SXNFbnVtZXJhYmxlID0gb2JqZWN0UHJvdG8ucHJvcGVydHlJc0VudW1lcmFibGU7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgbGlrZWx5IGFuIGBhcmd1bWVudHNgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDAuMS4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBgYXJndW1lbnRzYCBvYmplY3QsXG4gKiAgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJndW1lbnRzKGZ1bmN0aW9uKCkgeyByZXR1cm4gYXJndW1lbnRzOyB9KCkpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcmd1bWVudHMoWzEsIDIsIDNdKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbnZhciBpc0FyZ3VtZW50cyA9IGJhc2VJc0FyZ3VtZW50cyhmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKSA/IGJhc2VJc0FyZ3VtZW50cyA6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIGhhc093blByb3BlcnR5LmNhbGwodmFsdWUsICdjYWxsZWUnKSAmJlxuICAgICFwcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHZhbHVlLCAnY2FsbGVlJyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJndW1lbnRzO1xuIiwiLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGFuIGBBcnJheWAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgMC4xLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIGFycmF5LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheShkb2N1bWVudC5ib2R5LmNoaWxkcmVuKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0FycmF5KCdhYmMnKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0FycmF5KF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheTtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgnLi9pc0Z1bmN0aW9uJyksXG4gICAgaXNMZW5ndGggPSByZXF1aXJlKCcuL2lzTGVuZ3RoJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZS4gQSB2YWx1ZSBpcyBjb25zaWRlcmVkIGFycmF5LWxpa2UgaWYgaXQnc1xuICogbm90IGEgZnVuY3Rpb24gYW5kIGhhcyBhIGB2YWx1ZS5sZW5ndGhgIHRoYXQncyBhbiBpbnRlZ2VyIGdyZWF0ZXIgdGhhbiBvclxuICogZXF1YWwgdG8gYDBgIGFuZCBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gYE51bWJlci5NQVhfU0FGRV9JTlRFR0VSYC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMC4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoJ2FiYycpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPSBudWxsICYmIGlzTGVuZ3RoKHZhbHVlLmxlbmd0aCkgJiYgIWlzRnVuY3Rpb24odmFsdWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXlMaWtlO1xuIiwidmFyIHJvb3QgPSByZXF1aXJlKCcuL19yb290JyksXG4gICAgc3R1YkZhbHNlID0gcmVxdWlyZSgnLi9zdHViRmFsc2UnKTtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYC4gKi9cbnZhciBmcmVlRXhwb3J0cyA9IHR5cGVvZiBleHBvcnRzID09ICdvYmplY3QnICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUgJiYgZXhwb3J0cztcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBtb2R1bGVgLiAqL1xudmFyIGZyZWVNb2R1bGUgPSBmcmVlRXhwb3J0cyAmJiB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJiAhbW9kdWxlLm5vZGVUeXBlICYmIG1vZHVsZTtcblxuLyoqIERldGVjdCB0aGUgcG9wdWxhciBDb21tb25KUyBleHRlbnNpb24gYG1vZHVsZS5leHBvcnRzYC4gKi9cbnZhciBtb2R1bGVFeHBvcnRzID0gZnJlZU1vZHVsZSAmJiBmcmVlTW9kdWxlLmV4cG9ydHMgPT09IGZyZWVFeHBvcnRzO1xuXG4vKiogQnVpbHQtaW4gdmFsdWUgcmVmZXJlbmNlcy4gKi9cbnZhciBCdWZmZXIgPSBtb2R1bGVFeHBvcnRzID8gcm9vdC5CdWZmZXIgOiB1bmRlZmluZWQ7XG5cbi8qIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVJc0J1ZmZlciA9IEJ1ZmZlciA/IEJ1ZmZlci5pc0J1ZmZlciA6IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIGJ1ZmZlci5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDQuMy4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIGJ1ZmZlciwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQnVmZmVyKG5ldyBCdWZmZXIoMikpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNCdWZmZXIobmV3IFVpbnQ4QXJyYXkoMikpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xudmFyIGlzQnVmZmVyID0gbmF0aXZlSXNCdWZmZXIgfHwgc3R1YkZhbHNlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQnVmZmVyO1xuIiwidmFyIGJhc2VHZXRUYWcgPSByZXF1aXJlKCcuL19iYXNlR2V0VGFnJyksXG4gICAgaXNPYmplY3QgPSByZXF1aXJlKCcuL2lzT2JqZWN0Jyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBhc3luY1RhZyA9ICdbb2JqZWN0IEFzeW5jRnVuY3Rpb25dJyxcbiAgICBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICBnZW5UYWcgPSAnW29iamVjdCBHZW5lcmF0b3JGdW5jdGlvbl0nLFxuICAgIHByb3h5VGFnID0gJ1tvYmplY3QgUHJveHldJztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSAwLjEuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBmdW5jdGlvbiwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgaWYgKCFpc09iamVjdCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA5IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5cyBhbmQgb3RoZXIgY29uc3RydWN0b3JzLlxuICB2YXIgdGFnID0gYmFzZUdldFRhZyh2YWx1ZSk7XG4gIHJldHVybiB0YWcgPT0gZnVuY1RhZyB8fCB0YWcgPT0gZ2VuVGFnIHx8IHRhZyA9PSBhc3luY1RhZyB8fCB0YWcgPT0gcHJveHlUYWc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvbjtcbiIsIi8qKiBVc2VkIGFzIHJlZmVyZW5jZXMgZm9yIHZhcmlvdXMgYE51bWJlcmAgY29uc3RhbnRzLiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgbWV0aG9kIGlzIGxvb3NlbHkgYmFzZWQgb25cbiAqIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi83LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSA0LjAuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0xlbmd0aCgzKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTGVuZ3RoKE51bWJlci5NSU5fVkFMVUUpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzTGVuZ3RoKEluZmluaXR5KTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0xlbmd0aCgnMycpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJlxuICAgIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0xlbmd0aDtcbiIsIi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYG51bGxgIG9yIGB1bmRlZmluZWRgLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgNC4wLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG51bGxpc2gsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc05pbChudWxsKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTmlsKHZvaWQgMCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc05pbChOYU4pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNOaWwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09IG51bGw7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNOaWw7XG4iLCJ2YXIgYmFzZUdldFRhZyA9IHJlcXVpcmUoJy4vX2Jhc2VHZXRUYWcnKSxcbiAgICBpc09iamVjdExpa2UgPSByZXF1aXJlKCcuL2lzT2JqZWN0TGlrZScpO1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgbnVtYmVyVGFnID0gJ1tvYmplY3QgTnVtYmVyXSc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBOdW1iZXJgIHByaW1pdGl2ZSBvciBvYmplY3QuXG4gKlxuICogKipOb3RlOioqIFRvIGV4Y2x1ZGUgYEluZmluaXR5YCwgYC1JbmZpbml0eWAsIGFuZCBgTmFOYCwgd2hpY2ggYXJlXG4gKiBjbGFzc2lmaWVkIGFzIG51bWJlcnMsIHVzZSB0aGUgYF8uaXNGaW5pdGVgIG1ldGhvZC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHNpbmNlIDAuMS4wXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIG51bWJlciwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTnVtYmVyKDMpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNOdW1iZXIoTnVtYmVyLk1JTl9WQUxVRSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc051bWJlcihJbmZpbml0eSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc051bWJlcignMycpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNOdW1iZXIodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fFxuICAgIChpc09iamVjdExpa2UodmFsdWUpICYmIGJhc2VHZXRUYWcodmFsdWUpID09IG51bWJlclRhZyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNOdW1iZXI7XG4iLCIvKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZVxuICogW2xhbmd1YWdlIHR5cGVdKGh0dHA6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi83LjAvI3NlYy1lY21hc2NyaXB0LWxhbmd1YWdlLXR5cGVzKVxuICogb2YgYE9iamVjdGAuIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgMC4xLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc09iamVjdDtcbiIsIi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuIEEgdmFsdWUgaXMgb2JqZWN0LWxpa2UgaWYgaXQncyBub3QgYG51bGxgXG4gKiBhbmQgaGFzIGEgYHR5cGVvZmAgcmVzdWx0IG9mIFwib2JqZWN0XCIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSA0LjAuMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdExpa2Uoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc09iamVjdExpa2UobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzT2JqZWN0TGlrZTtcbiIsInZhciBiYXNlR2V0VGFnID0gcmVxdWlyZSgnLi9fYmFzZUdldFRhZycpLFxuICAgIGdldFByb3RvdHlwZSA9IHJlcXVpcmUoJy4vX2dldFByb3RvdHlwZScpLFxuICAgIGlzT2JqZWN0TGlrZSA9IHJlcXVpcmUoJy4vaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RUYWcgPSAnW29iamVjdCBPYmplY3RdJztcblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZSxcbiAgICBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGRlY29tcGlsZWQgc291cmNlIG9mIGZ1bmN0aW9ucy4gKi9cbnZhciBmdW5jVG9TdHJpbmcgPSBmdW5jUHJvdG8udG9TdHJpbmc7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKiBVc2VkIHRvIGluZmVyIHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3Rvci4gKi9cbnZhciBvYmplY3RDdG9yU3RyaW5nID0gZnVuY1RvU3RyaW5nLmNhbGwoT2JqZWN0KTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHBsYWluIG9iamVjdCwgdGhhdCBpcywgYW4gb2JqZWN0IGNyZWF0ZWQgYnkgdGhlXG4gKiBgT2JqZWN0YCBjb25zdHJ1Y3RvciBvciBvbmUgd2l0aCBhIGBbW1Byb3RvdHlwZV1dYCBvZiBgbnVsbGAuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSAwLjguMFxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogfVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdChuZXcgRm9vKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc1BsYWluT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdCh7ICd4JzogMCwgJ3knOiAwIH0pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNQbGFpbk9iamVjdChPYmplY3QuY3JlYXRlKG51bGwpKTtcbiAqIC8vID0+IHRydWVcbiAqL1xuZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZSkge1xuICBpZiAoIWlzT2JqZWN0TGlrZSh2YWx1ZSkgfHwgYmFzZUdldFRhZyh2YWx1ZSkgIT0gb2JqZWN0VGFnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZhciBwcm90byA9IGdldFByb3RvdHlwZSh2YWx1ZSk7XG4gIGlmIChwcm90byA9PT0gbnVsbCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHZhciBDdG9yID0gaGFzT3duUHJvcGVydHkuY2FsbChwcm90bywgJ2NvbnN0cnVjdG9yJykgJiYgcHJvdG8uY29uc3RydWN0b3I7XG4gIHJldHVybiB0eXBlb2YgQ3RvciA9PSAnZnVuY3Rpb24nICYmIEN0b3IgaW5zdGFuY2VvZiBDdG9yICYmXG4gICAgZnVuY1RvU3RyaW5nLmNhbGwoQ3RvcikgPT0gb2JqZWN0Q3RvclN0cmluZztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc1BsYWluT2JqZWN0O1xuIiwidmFyIGJhc2VHZXRUYWcgPSByZXF1aXJlKCcuL19iYXNlR2V0VGFnJyksXG4gICAgaXNBcnJheSA9IHJlcXVpcmUoJy4vaXNBcnJheScpLFxuICAgIGlzT2JqZWN0TGlrZSA9IHJlcXVpcmUoJy4vaXNPYmplY3RMaWtlJyk7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBzdHJpbmdUYWcgPSAnW29iamVjdCBTdHJpbmddJztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYFN0cmluZ2AgcHJpbWl0aXZlIG9yIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAc2luY2UgMC4xLjBcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHN0cmluZywgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzU3RyaW5nKCdhYmMnKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzU3RyaW5nKDEpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNTdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJyB8fFxuICAgICghaXNBcnJheSh2YWx1ZSkgJiYgaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBiYXNlR2V0VGFnKHZhbHVlKSA9PSBzdHJpbmdUYWcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzU3RyaW5nO1xuIiwidmFyIGJhc2VHZXRUYWcgPSByZXF1aXJlKCcuL19iYXNlR2V0VGFnJyksXG4gICAgaXNPYmplY3RMaWtlID0gcmVxdWlyZSgnLi9pc09iamVjdExpa2UnKTtcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIHN5bWJvbFRhZyA9ICdbb2JqZWN0IFN5bWJvbF0nO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgU3ltYm9sYCBwcmltaXRpdmUgb3Igb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgNC4wLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgc3ltYm9sLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNTeW1ib2woU3ltYm9sLml0ZXJhdG9yKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzU3ltYm9sKCdhYmMnKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzU3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ3N5bWJvbCcgfHxcbiAgICAoaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBiYXNlR2V0VGFnKHZhbHVlKSA9PSBzeW1ib2xUYWcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzU3ltYm9sO1xuIiwidmFyIGJhc2VJc1R5cGVkQXJyYXkgPSByZXF1aXJlKCcuL19iYXNlSXNUeXBlZEFycmF5JyksXG4gICAgYmFzZVVuYXJ5ID0gcmVxdWlyZSgnLi9fYmFzZVVuYXJ5JyksXG4gICAgbm9kZVV0aWwgPSByZXF1aXJlKCcuL19ub2RlVXRpbCcpO1xuXG4vKiBOb2RlLmpzIGhlbHBlciByZWZlcmVuY2VzLiAqL1xudmFyIG5vZGVJc1R5cGVkQXJyYXkgPSBub2RlVXRpbCAmJiBub2RlVXRpbC5pc1R5cGVkQXJyYXk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIHR5cGVkIGFycmF5LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgMy4wLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdHlwZWQgYXJyYXksIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc1R5cGVkQXJyYXkobmV3IFVpbnQ4QXJyYXkpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNUeXBlZEFycmF5KFtdKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbnZhciBpc1R5cGVkQXJyYXkgPSBub2RlSXNUeXBlZEFycmF5ID8gYmFzZVVuYXJ5KG5vZGVJc1R5cGVkQXJyYXkpIDogYmFzZUlzVHlwZWRBcnJheTtcblxubW9kdWxlLmV4cG9ydHMgPSBpc1R5cGVkQXJyYXk7XG4iLCJ2YXIgYXJyYXlMaWtlS2V5cyA9IHJlcXVpcmUoJy4vX2FycmF5TGlrZUtleXMnKSxcbiAgICBiYXNlS2V5cyA9IHJlcXVpcmUoJy4vX2Jhc2VLZXlzJyksXG4gICAgaXNBcnJheUxpa2UgPSByZXF1aXJlKCcuL2lzQXJyYXlMaWtlJyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiB0aGUgb3duIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIE5vbi1vYmplY3QgdmFsdWVzIGFyZSBjb2VyY2VkIHRvIG9iamVjdHMuIFNlZSB0aGVcbiAqIFtFUyBzcGVjXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi83LjAvI3NlYy1vYmplY3Qua2V5cylcbiAqIGZvciBtb3JlIGRldGFpbHMuXG4gKlxuICogQHN0YXRpY1xuICogQHNpbmNlIDAuMS4wXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogICB0aGlzLmIgPSAyO1xuICogfVxuICpcbiAqIEZvby5wcm90b3R5cGUuYyA9IDM7XG4gKlxuICogXy5rZXlzKG5ldyBGb28pO1xuICogLy8gPT4gWydhJywgJ2InXSAoaXRlcmF0aW9uIG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICpcbiAqIF8ua2V5cygnaGknKTtcbiAqIC8vID0+IFsnMCcsICcxJ11cbiAqL1xuZnVuY3Rpb24ga2V5cyhvYmplY3QpIHtcbiAgcmV0dXJuIGlzQXJyYXlMaWtlKG9iamVjdCkgPyBhcnJheUxpa2VLZXlzKG9iamVjdCkgOiBiYXNlS2V5cyhvYmplY3QpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGtleXM7XG4iLCJ2YXIgTWFwQ2FjaGUgPSByZXF1aXJlKCcuL19NYXBDYWNoZScpO1xuXG4vKiogRXJyb3IgbWVzc2FnZSBjb25zdGFudHMuICovXG52YXIgRlVOQ19FUlJPUl9URVhUID0gJ0V4cGVjdGVkIGEgZnVuY3Rpb24nO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IG1lbW9pemVzIHRoZSByZXN1bHQgb2YgYGZ1bmNgLiBJZiBgcmVzb2x2ZXJgIGlzXG4gKiBwcm92aWRlZCwgaXQgZGV0ZXJtaW5lcyB0aGUgY2FjaGUga2V5IGZvciBzdG9yaW5nIHRoZSByZXN1bHQgYmFzZWQgb24gdGhlXG4gKiBhcmd1bWVudHMgcHJvdmlkZWQgdG8gdGhlIG1lbW9pemVkIGZ1bmN0aW9uLiBCeSBkZWZhdWx0LCB0aGUgZmlyc3QgYXJndW1lbnRcbiAqIHByb3ZpZGVkIHRvIHRoZSBtZW1vaXplZCBmdW5jdGlvbiBpcyB1c2VkIGFzIHRoZSBtYXAgY2FjaGUga2V5LiBUaGUgYGZ1bmNgXG4gKiBpcyBpbnZva2VkIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBtZW1vaXplZCBmdW5jdGlvbi5cbiAqXG4gKiAqKk5vdGU6KiogVGhlIGNhY2hlIGlzIGV4cG9zZWQgYXMgdGhlIGBjYWNoZWAgcHJvcGVydHkgb24gdGhlIG1lbW9pemVkXG4gKiBmdW5jdGlvbi4gSXRzIGNyZWF0aW9uIG1heSBiZSBjdXN0b21pemVkIGJ5IHJlcGxhY2luZyB0aGUgYF8ubWVtb2l6ZS5DYWNoZWBcbiAqIGNvbnN0cnVjdG9yIHdpdGggb25lIHdob3NlIGluc3RhbmNlcyBpbXBsZW1lbnQgdGhlXG4gKiBbYE1hcGBdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzcuMC8jc2VjLXByb3BlcnRpZXMtb2YtdGhlLW1hcC1wcm90b3R5cGUtb2JqZWN0KVxuICogbWV0aG9kIGludGVyZmFjZSBvZiBgY2xlYXJgLCBgZGVsZXRlYCwgYGdldGAsIGBoYXNgLCBhbmQgYHNldGAuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBzaW5jZSAwLjEuMFxuICogQGNhdGVnb3J5IEZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBoYXZlIGl0cyBvdXRwdXQgbWVtb2l6ZWQuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbcmVzb2x2ZXJdIFRoZSBmdW5jdGlvbiB0byByZXNvbHZlIHRoZSBjYWNoZSBrZXkuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBtZW1vaXplZCBmdW5jdGlvbi5cbiAqIEBleGFtcGxlXG4gKlxuICogdmFyIG9iamVjdCA9IHsgJ2EnOiAxLCAnYic6IDIgfTtcbiAqIHZhciBvdGhlciA9IHsgJ2MnOiAzLCAnZCc6IDQgfTtcbiAqXG4gKiB2YXIgdmFsdWVzID0gXy5tZW1vaXplKF8udmFsdWVzKTtcbiAqIHZhbHVlcyhvYmplY3QpO1xuICogLy8gPT4gWzEsIDJdXG4gKlxuICogdmFsdWVzKG90aGVyKTtcbiAqIC8vID0+IFszLCA0XVxuICpcbiAqIG9iamVjdC5hID0gMjtcbiAqIHZhbHVlcyhvYmplY3QpO1xuICogLy8gPT4gWzEsIDJdXG4gKlxuICogLy8gTW9kaWZ5IHRoZSByZXN1bHQgY2FjaGUuXG4gKiB2YWx1ZXMuY2FjaGUuc2V0KG9iamVjdCwgWydhJywgJ2InXSk7XG4gKiB2YWx1ZXMob2JqZWN0KTtcbiAqIC8vID0+IFsnYScsICdiJ11cbiAqXG4gKiAvLyBSZXBsYWNlIGBfLm1lbW9pemUuQ2FjaGVgLlxuICogXy5tZW1vaXplLkNhY2hlID0gV2Vha01hcDtcbiAqL1xuZnVuY3Rpb24gbWVtb2l6ZShmdW5jLCByZXNvbHZlcikge1xuICBpZiAodHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJyB8fCAocmVzb2x2ZXIgIT0gbnVsbCAmJiB0eXBlb2YgcmVzb2x2ZXIgIT0gJ2Z1bmN0aW9uJykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKEZVTkNfRVJST1JfVEVYVCk7XG4gIH1cbiAgdmFyIG1lbW9pemVkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXG4gICAgICAgIGtleSA9IHJlc29sdmVyID8gcmVzb2x2ZXIuYXBwbHkodGhpcywgYXJncykgOiBhcmdzWzBdLFxuICAgICAgICBjYWNoZSA9IG1lbW9pemVkLmNhY2hlO1xuXG4gICAgaWYgKGNhY2hlLmhhcyhrZXkpKSB7XG4gICAgICByZXR1cm4gY2FjaGUuZ2V0KGtleSk7XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIG1lbW9pemVkLmNhY2hlID0gY2FjaGUuc2V0KGtleSwgcmVzdWx0KSB8fCBjYWNoZTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuICBtZW1vaXplZC5jYWNoZSA9IG5ldyAobWVtb2l6ZS5DYWNoZSB8fCBNYXBDYWNoZSk7XG4gIHJldHVybiBtZW1vaXplZDtcbn1cblxuLy8gRXhwb3NlIGBNYXBDYWNoZWAuXG5tZW1vaXplLkNhY2hlID0gTWFwQ2FjaGU7XG5cbm1vZHVsZS5leHBvcnRzID0gbWVtb2l6ZTtcbiIsIi8qKlxuICogVGhpcyBtZXRob2QgcmV0dXJucyBgZmFsc2VgLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgNC4xMy4wXG4gKiBAY2F0ZWdvcnkgVXRpbFxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy50aW1lcygyLCBfLnN0dWJGYWxzZSk7XG4gKiAvLyA9PiBbZmFsc2UsIGZhbHNlXVxuICovXG5mdW5jdGlvbiBzdHViRmFsc2UoKSB7XG4gIHJldHVybiBmYWxzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzdHViRmFsc2U7XG4iLCJ2YXIgYmFzZVRvU3RyaW5nID0gcmVxdWlyZSgnLi9fYmFzZVRvU3RyaW5nJyk7XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhIHN0cmluZy4gQW4gZW1wdHkgc3RyaW5nIGlzIHJldHVybmVkIGZvciBgbnVsbGBcbiAqIGFuZCBgdW5kZWZpbmVkYCB2YWx1ZXMuIFRoZSBzaWduIG9mIGAtMGAgaXMgcHJlc2VydmVkLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAc2luY2UgNC4wLjBcbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjb252ZXJ0LlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgY29udmVydGVkIHN0cmluZy5cbiAqIEBleGFtcGxlXG4gKlxuICogXy50b1N0cmluZyhudWxsKTtcbiAqIC8vID0+ICcnXG4gKlxuICogXy50b1N0cmluZygtMCk7XG4gKiAvLyA9PiAnLTAnXG4gKlxuICogXy50b1N0cmluZyhbMSwgMiwgM10pO1xuICogLy8gPT4gJzEsMiwzJ1xuICovXG5mdW5jdGlvbiB0b1N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT0gbnVsbCA/ICcnIDogYmFzZVRvU3RyaW5nKHZhbHVlKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0b1N0cmluZztcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iXX0=
