'use strict';Object.defineProperty(exports,'__esModule',{value:true});var vueRuntimeHelpers=require('vue-runtime-helpers');var _debounce = function (func, wait) {
  var timeout;

  return function() {
    var context = this;
    var args = arguments;
    var later = function () {
      timeout = null;

      func.apply(context, args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (!timeout) {
      func.apply(context, args);
    }
  };
};

var script = {
  name: 'VirtualList',

  props: {
    itemHeight: {
      type: Number,
      required: true
    },
    remain: {
      type: Number,
      required: true
    },
    rtag: {
      type: String,
      default: 'div'
    },
    wtag: {
      type: String,
      default: 'div'
    },
    wclass: {
      type: String,
      default: ''
    },
    pagemode: Boolean,
    scrollelement: {
      type: typeof window === 'undefined' ? Object : HTMLElement,
      default: null
    },
    start: {
      type: Number,
      default: 0
    },
    offset: {
      type: Number,
      default: 0
    },
    variable: {
      type: [Function, Boolean],
      default: false
    },
    bench: {
      type: Number,
      default: 0 // also equal to remain
    },
    debounce: {
      type: Number,
      default: 0
    },
    totop: {
      type: [Function, Boolean], // Boolean just disable for priviate.
      default: false
    },
    tobottom: {
      type: [Function, Boolean], // Boolean just disable for priviate.
      default: false
    },
    onscroll: {
      type: [Function, Boolean], // Boolean just disable for priviate.
      default: false
    },
    item: {
      type: Object,
      default: null
    },
    itemcount: {
      type: Number,
      default: 0
    },
    itemprops: {
      type: Function,
      default: function default$1() {}
    }
  },

  // use changeProp to identify which prop change.
  watch: {
    itemHeight: function itemHeight() {
      this.changeProp = 'itemHeight';
    },

    remain: function remain() {
      this.changeProp = 'remain';
    },

    bench: function bench() {
      this.changeProp = 'bench';
      this.itemModeForceRender();
    },

    start: function start() {
      this.changeProp = 'start';
      this.itemModeForceRender();
    },

    offset: function offset() {
      this.changeProp = 'offset';
      this.itemModeForceRender();
    },

    itemcount: function itemcount() {
      this.changeProp = 'itemcount';
      this.itemModeForceRender();
    },

    scrollelement: function scrollelement(newScrollelement, oldScrollelement) {
      if (this.pagemode) {
        return;
      }
      if (oldScrollelement) {
        this.removeScrollListener(oldScrollelement);
      }
      if (newScrollelement) {
        this.addScrollListener(newScrollelement);
      }
    }
  },

  created: function created() {
    var start = this.start >= this.remain ? this.start : 0;
    var keeps = this.remain + (this.bench || this.remain);

    var delta = Object.create(null);

    delta.direction = ''; // current scroll direction, D: down, U: up.
    delta.scrollTop = 0; // current scroll top, use to direction.
    delta.start = start; // start index.
    delta.end = start + keeps - 1; // end index.
    delta.keeps = keeps; // nums keeping in real dom.
    delta.total = 0; // all items count, update in filter.
    delta.offsetAll = 0; // cache all the scrollable offset.
    delta.paddingTop = 0; // container wrapper real padding-top.
    delta.paddingBottom = 0; // container wrapper real padding-bottom.
    delta.varCache = {}; // object to cache variable index height and scroll offset.
    delta.varAverItemHeight = 0; // average/estimate item height before variable be calculated.
    delta.varLastCalcIndex = 0; // last calculated variable height/offset index, always increase.

    this.delta = delta;
  },

  mounted: function mounted() {
    if (this.pagemode) {
      this.addScrollListener(window);
    } else if (this.scrollelement) {
      this.addScrollListener(this.scrollelement);
    }

    if (this.start) {
      var start = this.getZone(this.start).start;
      this.setScrollTop(this.variable ? this.getVarOffset(start) : start * this.itemHeight);
    } else if (this.offset) {
      this.setScrollTop(this.offset);
    }
  },

  beforeDestroy: function beforeDestroy() {
    if (this.pagemode) {
      this.removeScrollListener(window);
    } else if (this.scrollelement) {
      this.removeScrollListener(this.scrollelement);
    }
  },

  // check if delta should update when props change.
  beforeUpdate: function beforeUpdate() {
    var delta = this.delta;
    var calcstart = this.changeProp === 'start' ? this.start : delta.start;
    var zone = this.getZone(calcstart);

    delta.keeps = this.remain + (this.bench || this.remain);

    // if start, itemHeight or offset change, update scroll position.
    if (this.changeProp && ['start', 'itemHeight', 'offset'].includes(this.changeProp)) {
      var scrollTop =
        this.changeProp === 'offset'
          ? this.offset
          : this.variable
          ? this.getVarOffset(zone.isLast ? delta.total : zone.start)
          : zone.isLast && delta.total - calcstart <= this.remain
          ? delta.total * this.itemHeight
          : calcstart * this.itemHeight;

      this.$nextTick(this.setScrollTop.bind(this, scrollTop));
    }
  },

  updated: function updated() {
    var delta = this.delta;
    var calcstart = this.changeProp === 'start' ? this.start : delta.start;
    var zone = this.getZone(calcstart);

    delta.keeps = this.remain + (this.bench || this.remain);

    // if points out difference, force update once again.
    if (this.changeProp || (delta.end !== zone.end && !zone.isLast) || calcstart !== zone.start) {
      this.changeProp = '';
      delta.end = zone.end;
      delta.start = zone.start;
      this.forceRender();
    }
  },

  methods: {
    // add pagemode/scrollelement scroll event listener
    addScrollListener: function addScrollListener(element) {
      this.scrollHandler = this.debounce
        ? _debounce(this.onScroll.bind(this), this.debounce)
        : this.onScroll;
      element.addEventListener('scroll', this.scrollHandler, false);
    },

    // remove pagemode/scrollelement scroll event listener
    removeScrollListener: function removeScrollListener(element) {
      element.removeEventListener('scroll', this.scrollHandler, false);
    },

    onScroll: function onScroll(event) {
      var delta = this.delta;
      var vsl = this.$refs.vsl;
      var offsetAll = delta.offsetAll;
      var offset;

      if (this.pagemode) {
        var elemRect = this.$el.getBoundingClientRect();

        offset = -elemRect.top;
      } else if (this.scrollelement) {
        var scrollelementRect = this.scrollelement.getBoundingClientRect();
        var elemRect$1 = this.$el.getBoundingClientRect();

        offset = scrollelementRect.top - elemRect$1.top;
      } else {
        offset = (vsl.$el || vsl).scrollTop || 0;
      }

      delta.direction = offset > delta.scrollTop ? 'D' : 'U';
      delta.scrollTop = offset;

      if (delta.total > delta.keeps) {
        this.updateZone(offset);
      } else {
        delta.end = delta.total - 1;
      }

      if (this.onscroll) {
        var param = Object.create(null);

        param.offset = offset;
        param.offsetAll = offsetAll;
        param.start = delta.start;
        param.end = delta.end;

        this.onscroll(event, param);
      }

      if (!offset && delta.total) {
        this.fireEvent('totop');
      }

      if (offset >= offsetAll) {
        this.fireEvent('tobottom');
      }
    },

    // update render zone by scroll offset.
    updateZone: function updateZone(offset) {
      var delta = this.delta;
      var overs = this.variable ? this.getVarOvers(offset) : Math.floor(offset / this.itemHeight);

      // if scroll up, we'd better decrease it's numbers.
      if (delta.direction === 'U') {
        overs = overs - this.remain + 1;
      }

      var zone = this.getZone(overs);
      var bench = this.bench || this.remain;

      // for better performance, if scroll pass items within now bench, do not update.
      // and if overs is going to reach last item, we should render next zone immediately.
      var shouldRenderNextZone = Math.abs(overs - delta.start - bench) === 1;
      if (
        !shouldRenderNextZone &&
        overs - delta.start <= bench &&
        !zone.isLast &&
        overs > delta.start
      ) {
        return;
      }

      // we'd better make sure forceRender calls as less as possible.
      if (shouldRenderNextZone || zone.start !== delta.start || zone.end !== delta.end) {
        delta.end = zone.end;
        delta.start = zone.start;
        this.forceRender();
      }
    },

    // return the right zone info base on `start/index`.
    getZone: function getZone(index) {
      var delta = this.delta;
      var lastStart = delta.total - delta.keeps;
      var start;
      var isLast;

      index = parseInt(index, 10);
      index = Math.max(0, index);

      isLast = (index <= delta.total && index >= lastStart) || index > delta.total;

      if (isLast) {
        start = Math.max(0, lastStart);
      } else {
        start = index;
      }

      return {
        end: start + delta.keeps - 1,
        start: start,
        isLast: isLast
      };
    },

    // public method, force render ui list if we needed.
    // call this before the next repaint to get better performance.
    forceRender: function forceRender() {
      var this$1 = this;

      window.requestAnimationFrame(function () {
        this$1.$forceUpdate();
      });
    },

    // force render ui if using item-mode.
    itemModeForceRender: function itemModeForceRender() {
      if (this.item) {
        this.forceRender();
      }
    },

    // return the scroll passed items count in variable.
    getVarOvers: function getVarOvers(offset) {
      var delta = this.delta;
      var low = 0;
      var middle = 0;
      var middleOffset = 0;
      var high = delta.total;

      while (low <= high) {
        middle = low + Math.floor((high - low) / 2);
        middleOffset = this.getVarOffset(middle);

        // calculate the average variable height at first binary search.
        if (!delta.varAverItemHeight) {
          delta.varAverItemHeight = Math.floor(middleOffset / middle);
        }

        if (middleOffset === offset) {
          return middle;
        } else if (middleOffset < offset) {
          low = middle + 1;
        } else if (middleOffset > offset) {
          high = middle - 1;
        }
      }

      return low > 0 ? --low : 0;
    },

    // return a variable scroll offset from given index.
    getVarOffset: function getVarOffset(index, nocache) {
      var delta = this.delta;
      var cache = delta.varCache[index];
      var offset = 0;

      if (!nocache && cache) {
        return cache.offset;
      }

      for (var i = 0; i < index; i++) {
        var itemHeight = this.getVarItemHeight(i, nocache);

        delta.varCache[i] = {
          itemHeight: itemHeight,
          offset: offset
        };
        offset += itemHeight;
      }

      delta.varLastCalcIndex = Math.max(delta.varLastCalcIndex, index - 1);
      delta.varLastCalcIndex = Math.min(delta.varLastCalcIndex, delta.total - 1);

      return offset;
    },

    // return a variable itemHeight (height) from given index.
    getVarItemHeight: function getVarItemHeight(index, nocache) {
      var cache = this.delta.varCache[index];

      if (!nocache && cache) {
        return cache.itemHeight;
      }

      if (typeof this.variable === 'function') {
        return this.variable(index) || 0;
      }

      // when using item, it can only get current components height,
      // need to be enhanced, or consider using variable-function instead
      var slot = this.item
        ? this.$children[index]
          ? this.$children[index].$vnode
          : null
        : this.$slots.default[index];

      var style = slot && slot.data && slot.data.style;

      if (style && style.height) {
        var shm = style.height.match(/^(.*)px$/);
        return (shm && +shm[1]) || 0;
      }

      return 0;
    },

    // return the variable paddingTop base current zone.
    // @todo: if set a large `start` before variable was calculated,
    // here will also case too much offset calculate when list is very large,
    // consider use estimate paddingTop in this case just like `getVarPaddingBottom`.
    getVarPaddingTop: function getVarPaddingTop() {
      return this.getVarOffset(this.delta.start);
    },

    // return the variable paddingBottom base current zone.
    getVarPaddingBottom: function getVarPaddingBottom() {
      var delta = this.delta;
      var last = delta.total - 1;

      if (delta.total - delta.end <= delta.keeps || delta.varLastCalcIndex === last) {
        return this.getVarOffset(last) - this.getVarOffset(delta.end);
      }

      // if unreached last zone or uncalculate real behind offset
      // return the estimate paddingBottom avoid too much calculate.
      return (delta.total - delta.end) * (delta.varAverItemHeight || this.itemHeight);
    },

    // retun the variable all heights use to judge reach bottom.
    getVarAllHeight: function getVarAllHeight() {
      var delta = this.delta;

      if (delta.total - delta.end <= delta.keeps || delta.varLastCalcIndex === delta.total - 1) {
        return this.getVarOffset(delta.total);
      }

      return (
        this.getVarOffset(delta.start) +
        (delta.total - delta.end) * (delta.varAverItemHeight || this.itemHeight)
      );
    },

    // public method, allow the parent update variable by index.
    updateVariable: function updateVariable(index) {
      // clear/update all the offfsets and heights ahead of index.
      this.getVarOffset(index, true);
    },

    // trigger a props event on parent.
    fireEvent: function fireEvent(event) {
      if (this[event]) {
        this[event]();
      }
    },

    // set manual scroll top.
    setScrollTop: function setScrollTop(scrollTop) {
      if (this.pagemode) {
        window.scrollTo(0, scrollTop);
      } else if (this.scrollelement) {
        this.scrollelement.scrollTo(0, scrollTop);
      } else {
        var vsl = this.$refs.vsl;

        if (vsl) {
          (vsl.$el || vsl).scrollTop = scrollTop;
        }
      }
    },

    // filter the shown items base on `start` and `end`.
    filter: function filter(h) {
      var delta = this.delta;
      var slots = this.$slots.default || [];
      var renders = [];
      var paddingTop;
      var paddingBottom;
      var allHeight;
      var hasPadding;

      // item-mode shoud judge from items prop.
      if (this.item) {
        delta.total = this.itemcount;

        if (delta.keeps > delta.total) {
          delta.end = delta.total - 1;
        }
      } else {
        if (!slots.length) {
          delta.start = 0;
        }

        delta.total = slots.length;
      }

      hasPadding = delta.total > delta.keeps;

      if (this.variable) {
        allHeight = this.getVarAllHeight();
        paddingTop = hasPadding ? this.getVarPaddingTop() : 0;
        paddingBottom = hasPadding ? this.getVarPaddingBottom() : 0;
      } else {
        allHeight = this.itemHeight * delta.total;
        paddingTop = this.itemHeight * (hasPadding ? delta.start : 0);
        paddingBottom = this.itemHeight * (hasPadding ? delta.total - delta.keeps : 0) - paddingTop;
      }

      if (paddingBottom < this.itemHeight) {
        paddingBottom = 0;
      }

      delta.paddingTop = paddingTop;
      delta.paddingBottom = paddingBottom;
      delta.offsetAll = allHeight - this.itemHeight * this.remain;

      for (var i = delta.start; i < delta.total && i <= Math.ceil(delta.end); i++) {
        var slot = null;

        if (this.item) {
          slot = h(this.item, this.itemprops(i));
        } else {
          slot = slots[i];
        }

        renders.push(slot);
      }

      return renders;
    }
  },

  render: function render(h) {
    var dbc = this.debounce;
    var list = this.filter(h);
    var ref = this.delta;
    var paddingTop = ref.paddingTop;
    var paddingBottom = ref.paddingBottom;

    var renderList = h(
      this.wtag,
      {
        style: {
          display: 'block',
          'padding-top': paddingTop + 'px',
          'padding-bottom': paddingBottom + 'px'
        },
        class: this.wclass,
        attrs: {
          role: 'group'
        }
      },
      list
    );

    // page mode just render list, no wraper.
    if (this.pagemode || this.scrollelement) {
      return renderList;
    }

    return h(
      this.rtag,
      {
        ref: 'vsl',
        style: {
          display: 'block',
          'overflow-y': this.itemHeight >= this.remain ? 'auto' : 'inital',
          height: this.itemHeight * this.remain + 'px'
        },
        on: {
          '&scroll': dbc ? _debounce(this.onScroll.bind(this), dbc) : this.onScroll
        }
      },
      [renderList]
    );
  }
};/* script */
var __vue_script__ = script;

/* template */

  /* style */
  var __vue_inject_styles__ = undefined;
  /* scoped */
  var __vue_scope_id__ = undefined;
  /* module identifier */
  var __vue_module_identifier__ = "data-v-713eda38";
  /* functional template */
  var __vue_is_functional_template__ = undefined;
  /* style inject */
  
  /* style inject SSR */
  
  /* style inject shadow dom */
  

  
  var __vue_component__ = vueRuntimeHelpers.normalizeComponent(
    {},
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    false,
    undefined,
    undefined,
    undefined
  );// Import vue component

// install function executed by Vue.use()
function install(Vue) {
  if (install.installed) { return; }
  install.installed = true;
  Vue.component('VirtualList', __vue_component__);
}

// Create module definition for Vue.use()
var plugin = {
  install: install
};

// To auto-install when vue is found
var GlobalVue = null;
if (typeof window !== 'undefined') {
  GlobalVue = window.Vue;
} else if (typeof global !== 'undefined') {
  GlobalVue = global.Vue;
}
if (GlobalVue) {
  GlobalVue.use(plugin);
}

// Inject install function into component - allows component
// to be registered via Vue.use() as well as Vue.component()
__vue_component__.install = install;

// It's possible to expose named exports when writing components that can
// also be used as directives, etc. - eg. import { RollupDemoDirective } from 'rollup-demo';
// export const RollupDemoDirective = component;
exports.default=__vue_component__;