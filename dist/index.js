(function () {
	'use strict';

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn) {
	  var module = { exports: {} };
		return fn(module, module.exports), module.exports;
	}

	/* global NodeList, Element, Event, define */

	createCommonjsModule(function (module) {
	(function (global) {

	  var FOCUSABLE_ELEMENTS = [
	    'a[href]:not([tabindex^="-"]):not([inert])',
	    'area[href]:not([tabindex^="-"]):not([inert])',
	    'input:not([disabled]):not([inert])',
	    'select:not([disabled]):not([inert])',
	    'textarea:not([disabled]):not([inert])',
	    'button:not([disabled]):not([inert])',
	    'iframe:not([tabindex^="-"]):not([inert])',
	    'audio:not([tabindex^="-"]):not([inert])',
	    'video:not([tabindex^="-"]):not([inert])',
	    '[contenteditable]:not([tabindex^="-"]):not([inert])',
	    '[tabindex]:not([tabindex^="-"]):not([inert])',
	  ];
	  var TAB_KEY = 9;
	  var ESCAPE_KEY = 27;
	  var focusedBeforeDialog;

	  /**
	   * Define the constructor to instantiate a dialog
	   *
	   * @constructor
	   * @param {Element} node
	   * @param {(NodeList | Element | string)} targets
	   */
	  function A11yDialog(node, targets) {
	    // Prebind the functions that will be bound in addEventListener and
	    // removeEventListener to avoid losing references
	    this._show = this.show.bind(this);
	    this._hide = this.hide.bind(this);
	    this._maintainFocus = this._maintainFocus.bind(this);
	    this._bindKeypress = this._bindKeypress.bind(this);

	    // Keep a reference of the node and the actual dialog on the instance
	    this.container = node;
	    this.dialog = node.querySelector(
	      'dialog, [role="dialog"], [role="alertdialog"]'
	    );
	    this.role = this.dialog.getAttribute('role') || 'dialog';
	    this.useDialog =
	      'show' in document.createElement('dialog') &&
	      this.dialog.nodeName === 'DIALOG';

	    // Keep an object of listener types mapped to callback functions
	    this._listeners = {};

	    // Initialise everything needed for the dialog to work properly
	    this.create(targets);
	  }

	  /**
	   * Set up everything necessary for the dialog to be functioning
	   *
	   * @param {(NodeList | Element | string)} targets
	   * @return {this}
	   */
	  A11yDialog.prototype.create = function (targets) {
	    // Keep a collection of nodes to disable/enable when toggling the dialog
	    this._targets =
	      this._targets || collect(targets) || getSiblings(this.container);

	    // Set the `shown` property to match the status from the DOM
	    this.shown = this.dialog.hasAttribute('open');

	    // Despite using a `<dialog>` element, `role="dialog"` is not necessarily
	    // implied by all screen-readers (yet)
	    // See: https://github.com/edenspiekermann/a11y-dialog/commit/6ba711a777aed0dbda0719a18a02f742098c64d9#commitcomment-28694166
	    this.dialog.setAttribute('role', this.role);

	    if (!this.useDialog) {
	      if (this.shown) {
	        this.container.removeAttribute('aria-hidden');
	      } else {
	        this.container.setAttribute('aria-hidden', true);
	      }
	    } else {
	      this.container.setAttribute('data-a11y-dialog-native', '');
	      // Remove initial `aria-hidden` from container
	      // See: https://github.com/edenspiekermann/a11y-dialog/pull/117#issuecomment-706056246
	      this.container.removeAttribute('aria-hidden');
	    }

	    // Keep a collection of dialog openers, each of which will be bound a click
	    // event listener to open the dialog
	    this._openers = $$('[data-a11y-dialog-show="' + this.container.id + '"]');
	    this._openers.forEach(
	      function (opener) {
	        opener.addEventListener('click', this._show);
	      }.bind(this)
	    );

	    // Keep a collection of dialog closers, each of which will be bound a click
	    // event listener to close the dialog
	    this._closers = $$('[data-a11y-dialog-hide]', this.container).concat(
	      $$('[data-a11y-dialog-hide="' + this.container.id + '"]')
	    );
	    this._closers.forEach(
	      function (closer) {
	        closer.addEventListener('click', this._hide);
	      }.bind(this)
	    );

	    // Execute all callbacks registered for the `create` event
	    this._fire('create');

	    return this
	  };

	  /**
	   * Show the dialog element, disable all the targets (siblings), trap the
	   * current focus within it, listen for some specific key presses and fire all
	   * registered callbacks for `show` event
	   *
	   * @param {Event} event
	   * @return {this}
	   */
	  A11yDialog.prototype.show = function (event) {
	    // If the dialog is already open, abort
	    if (this.shown) {
	      return this
	    }

	    this.shown = true;

	    // Keep a reference to the currently focused element to be able to restore
	    // it later
	    focusedBeforeDialog = document.activeElement;

	    if (this.useDialog) {
	      this.dialog.showModal(event instanceof Event ? void 0 : event);
	    } else {
	      this.dialog.setAttribute('open', '');
	      this.container.removeAttribute('aria-hidden');

	      // Iterate over the targets to disable them by setting their `aria-hidden`
	      // attribute to `true` and, if present, storing the current value of `aria-hidden`
	      this._targets.forEach(function (target) {
	        if (target.hasAttribute('aria-hidden')) {
	          target.setAttribute(
	            'data-a11y-dialog-original-aria-hidden',
	            target.getAttribute('aria-hidden')
	          );
	        }
	        target.setAttribute('aria-hidden', 'true');
	      });
	    }

	    // Set the focus to the first focusable child of the dialog element
	    setFocusToFirstItem(this.dialog);

	    // Bind a focus event listener to the body element to make sure the focus
	    // stays trapped inside the dialog while open, and start listening for some
	    // specific key presses (TAB and ESC)
	    document.body.addEventListener('focus', this._maintainFocus, true);
	    document.addEventListener('keydown', this._bindKeypress);

	    // Execute all callbacks registered for the `show` event
	    this._fire('show', event);

	    return this
	  };

	  /**
	   * Hide the dialog element, enable all the targets (siblings), restore the
	   * focus to the previously active element, stop listening for some specific
	   * key presses and fire all registered callbacks for `hide` event
	   *
	   * @param {Event} event
	   * @return {this}
	   */
	  A11yDialog.prototype.hide = function (event) {
	    // If the dialog is already closed, abort
	    if (!this.shown) {
	      return this
	    }

	    this.shown = false;

	    if (this.useDialog) {
	      this.dialog.close(event instanceof Event ? void 0 : event);
	    } else {
	      this.dialog.removeAttribute('open');
	      this.container.setAttribute('aria-hidden', 'true');

	      // Iterate over the targets to enable them by removing their `aria-hidden`
	      // attribute or resetting it to its original value
	      this._targets.forEach(function (target) {
	        if (target.hasAttribute('data-a11y-dialog-original-aria-hidden')) {
	          target.setAttribute(
	            'aria-hidden',
	            target.getAttribute('data-a11y-dialog-original-aria-hidden')
	          );
	          target.removeAttribute('data-a11y-dialog-original-aria-hidden');
	        } else {
	          target.removeAttribute('aria-hidden');
	        }
	      });
	    }

	    // If there was a focused element before the dialog was opened (and it has a
	    // `focus` method), restore the focus back to it
	    // See: https://github.com/edenspiekermann/a11y-dialog/issues/108
	    if (focusedBeforeDialog && focusedBeforeDialog.focus) {
	      focusedBeforeDialog.focus();
	    }

	    // Remove the focus event listener to the body element and stop listening
	    // for specific key presses
	    document.body.removeEventListener('focus', this._maintainFocus, true);
	    document.removeEventListener('keydown', this._bindKeypress);

	    // Execute all callbacks registered for the `hide` event
	    this._fire('hide', event);

	    return this
	  };

	  /**
	   * Destroy the current instance (after making sure the dialog has been hidden)
	   * and remove all associated listeners from dialog openers and closers
	   *
	   * @return {this}
	   */
	  A11yDialog.prototype.destroy = function () {
	    // Hide the dialog to avoid destroying an open instance
	    this.hide();

	    // Remove the click event listener from all dialog openers
	    this._openers.forEach(
	      function (opener) {
	        opener.removeEventListener('click', this._show);
	      }.bind(this)
	    );

	    // Remove the click event listener from all dialog closers
	    this._closers.forEach(
	      function (closer) {
	        closer.removeEventListener('click', this._hide);
	      }.bind(this)
	    );

	    // Execute all callbacks registered for the `destroy` event
	    this._fire('destroy');

	    // Keep an object of listener types mapped to callback functions
	    this._listeners = {};

	    return this
	  };

	  /**
	   * Register a new callback for the given event type
	   *
	   * @param {string} type
	   * @param {Function} handler
	   */
	  A11yDialog.prototype.on = function (type, handler) {
	    if (typeof this._listeners[type] === 'undefined') {
	      this._listeners[type] = [];
	    }

	    this._listeners[type].push(handler);

	    return this
	  };

	  /**
	   * Unregister an existing callback for the given event type
	   *
	   * @param {string} type
	   * @param {Function} handler
	   */
	  A11yDialog.prototype.off = function (type, handler) {
	    var index = this._listeners[type].indexOf(handler);

	    if (index > -1) {
	      this._listeners[type].splice(index, 1);
	    }

	    return this
	  };

	  /**
	   * Iterate over all registered handlers for given type and call them all with
	   * the dialog element as first argument, event as second argument (if any).
	   *
	   * @access private
	   * @param {string} type
	   * @param {Event} event
	   */
	  A11yDialog.prototype._fire = function (type, event) {
	    var listeners = this._listeners[type] || [];

	    listeners.forEach(
	      function (listener) {
	        listener(this.container, event);
	      }.bind(this)
	    );
	  };

	  /**
	   * Private event handler used when listening to some specific key presses
	   * (namely ESCAPE and TAB)
	   *
	   * @access private
	   * @param {Event} event
	   */
	  A11yDialog.prototype._bindKeypress = function (event) {
	    // If the dialog is shown and the ESCAPE key is being pressed, prevent any
	    // further effects from the ESCAPE key and hide the dialog, unless its role
	    // is 'alertdialog', which should be modal
	    if (
	      this.shown &&
	      event.which === ESCAPE_KEY &&
	      this.role !== 'alertdialog'
	    ) {
	      event.preventDefault();
	      this.hide(event);
	    }

	    // If the dialog is shown and the TAB key is being pressed, make sure the
	    // focus stays trapped within the dialog element
	    if (this.shown && event.which === TAB_KEY) {
	      trapTabKey(this.dialog, event);
	    }
	  };

	  /**
	   * Private event handler used when making sure the focus stays within the
	   * currently open dialog
	   *
	   * @access private
	   * @param {Event} event
	   */
	  A11yDialog.prototype._maintainFocus = function (event) {
	    // If the dialog is shown and the focus is not within the dialog element,
	    // move it back to its first focusable child
	    if (this.shown && !this.container.contains(event.target)) {
	      setFocusToFirstItem(this.dialog);
	    }
	  };

	  /**
	   * Convert a NodeList into an array
	   *
	   * @param {NodeList} collection
	   * @return {Array<Element>}
	   */
	  function toArray(collection) {
	    return Array.prototype.slice.call(collection)
	  }

	  /**
	   * Query the DOM for nodes matching the given selector, scoped to context (or
	   * the whole document)
	   *
	   * @param {String} selector
	   * @param {Element} [context = document]
	   * @return {Array<Element>}
	   */
	  function $$(selector, context) {
	    return toArray((context || document).querySelectorAll(selector))
	  }

	  /**
	   * Return an array of Element based on given argument (NodeList, Element or
	   * string representing a selector)
	   *
	   * @param {(NodeList | Element | string)} target
	   * @return {Array<Element>}
	   */
	  function collect(target) {
	    if (NodeList.prototype.isPrototypeOf(target)) {
	      return toArray(target)
	    }

	    if (Element.prototype.isPrototypeOf(target)) {
	      return [target]
	    }

	    if (typeof target === 'string') {
	      return $$(target)
	    }
	  }

	  /**
	   * Set the focus to the first element with `autofocus` or the first focusable
	   * child of the given element
	   *
	   * @param {Element} node
	   */
	  function setFocusToFirstItem(node) {
	    var focusableChildren = getFocusableChildren(node);
	    var focused = node.querySelector('[autofocus]') || focusableChildren[0];

	    if (focused) {
	      focused.focus();
	    }
	  }

	  /**
	   * Get the focusable children of the given element
	   *
	   * @param {Element} node
	   * @return {Array<Element>}
	   */
	  function getFocusableChildren(node) {
	    return $$(FOCUSABLE_ELEMENTS.join(','), node).filter(function (child) {
	      return !!(
	        child.offsetWidth ||
	        child.offsetHeight ||
	        child.getClientRects().length
	      )
	    })
	  }

	  /**
	   * Trap the focus inside the given element
	   *
	   * @param {Element} node
	   * @param {Event} event
	   */
	  function trapTabKey(node, event) {
	    var focusableChildren = getFocusableChildren(node);
	    var focusedItemIndex = focusableChildren.indexOf(document.activeElement);

	    // If the SHIFT key is being pressed while tabbing (moving backwards) and
	    // the currently focused item is the first one, move the focus to the last
	    // focusable item from the dialog element
	    if (event.shiftKey && focusedItemIndex === 0) {
	      focusableChildren[focusableChildren.length - 1].focus();
	      event.preventDefault();
	      // If the SHIFT key is not being pressed (moving forwards) and the currently
	      // focused item is the last one, move the focus to the first focusable item
	      // from the dialog element
	    } else if (
	      !event.shiftKey &&
	      focusedItemIndex === focusableChildren.length - 1
	    ) {
	      focusableChildren[0].focus();
	      event.preventDefault();
	    }
	  }

	  /**
	   * Retrieve siblings from given element
	   *
	   * @param {Element} node
	   * @return {Array<Element>}
	   */
	  function getSiblings(node) {
	    var nodes = toArray(node.parentNode.childNodes);
	    var siblings = nodes.filter(function (node) {
	      return node.nodeType === 1
	    });

	    siblings.splice(siblings.indexOf(node), 1);

	    return siblings
	  }

	  function instantiateDialogs() {
	    $$('[data-a11y-dialog]').forEach(function (node) {
	      new A11yDialog(node, node.getAttribute('data-a11y-dialog') || undefined);
	    });
	  }

	  if (typeof global.document !== 'undefined') {
	    var document = global.document;

	    if (document.readyState === 'loading') {
	      document.addEventListener('DOMContentLoaded', instantiateDialogs);
	    } else {
	      if (global.requestAnimationFrame) {
	        global.requestAnimationFrame(instantiateDialogs);
	      } else {
	        global.setTimeout(instantiateDialogs, 16);
	      }
	    }
	  }

	  {
	    module.exports = A11yDialog;
	  }
	})(typeof commonjsGlobal !== 'undefined' ? commonjsGlobal : window);
	});

	createCommonjsModule(function (module, exports) {
	(function (global, factory) {
	  factory() ;
	}(commonjsGlobal, (function () {
	  /**
	   * Applies the :focus-visible polyfill at the given scope.
	   * A scope in this case is either the top-level Document or a Shadow Root.
	   *
	   * @param {(Document|ShadowRoot)} scope
	   * @see https://github.com/WICG/focus-visible
	   */
	  function applyFocusVisiblePolyfill(scope) {
	    var hadKeyboardEvent = true;
	    var hadFocusVisibleRecently = false;
	    var hadFocusVisibleRecentlyTimeout = null;

	    var inputTypesAllowlist = {
	      text: true,
	      search: true,
	      url: true,
	      tel: true,
	      email: true,
	      password: true,
	      number: true,
	      date: true,
	      month: true,
	      week: true,
	      time: true,
	      datetime: true,
	      'datetime-local': true
	    };

	    /**
	     * Helper function for legacy browsers and iframes which sometimes focus
	     * elements like document, body, and non-interactive SVG.
	     * @param {Element} el
	     */
	    function isValidFocusTarget(el) {
	      if (
	        el &&
	        el !== document &&
	        el.nodeName !== 'HTML' &&
	        el.nodeName !== 'BODY' &&
	        'classList' in el &&
	        'contains' in el.classList
	      ) {
	        return true;
	      }
	      return false;
	    }

	    /**
	     * Computes whether the given element should automatically trigger the
	     * `focus-visible` class being added, i.e. whether it should always match
	     * `:focus-visible` when focused.
	     * @param {Element} el
	     * @return {boolean}
	     */
	    function focusTriggersKeyboardModality(el) {
	      var type = el.type;
	      var tagName = el.tagName;

	      if (tagName === 'INPUT' && inputTypesAllowlist[type] && !el.readOnly) {
	        return true;
	      }

	      if (tagName === 'TEXTAREA' && !el.readOnly) {
	        return true;
	      }

	      if (el.isContentEditable) {
	        return true;
	      }

	      return false;
	    }

	    /**
	     * Add the `focus-visible` class to the given element if it was not added by
	     * the author.
	     * @param {Element} el
	     */
	    function addFocusVisibleClass(el) {
	      if (el.classList.contains('focus-visible')) {
	        return;
	      }
	      el.classList.add('focus-visible');
	      el.setAttribute('data-focus-visible-added', '');
	    }

	    /**
	     * Remove the `focus-visible` class from the given element if it was not
	     * originally added by the author.
	     * @param {Element} el
	     */
	    function removeFocusVisibleClass(el) {
	      if (!el.hasAttribute('data-focus-visible-added')) {
	        return;
	      }
	      el.classList.remove('focus-visible');
	      el.removeAttribute('data-focus-visible-added');
	    }

	    /**
	     * If the most recent user interaction was via the keyboard;
	     * and the key press did not include a meta, alt/option, or control key;
	     * then the modality is keyboard. Otherwise, the modality is not keyboard.
	     * Apply `focus-visible` to any current active element and keep track
	     * of our keyboard modality state with `hadKeyboardEvent`.
	     * @param {KeyboardEvent} e
	     */
	    function onKeyDown(e) {
	      if (e.metaKey || e.altKey || e.ctrlKey) {
	        return;
	      }

	      if (isValidFocusTarget(scope.activeElement)) {
	        addFocusVisibleClass(scope.activeElement);
	      }

	      hadKeyboardEvent = true;
	    }

	    /**
	     * If at any point a user clicks with a pointing device, ensure that we change
	     * the modality away from keyboard.
	     * This avoids the situation where a user presses a key on an already focused
	     * element, and then clicks on a different element, focusing it with a
	     * pointing device, while we still think we're in keyboard modality.
	     * @param {Event} e
	     */
	    function onPointerDown(e) {
	      hadKeyboardEvent = false;
	    }

	    /**
	     * On `focus`, add the `focus-visible` class to the target if:
	     * - the target received focus as a result of keyboard navigation, or
	     * - the event target is an element that will likely require interaction
	     *   via the keyboard (e.g. a text box)
	     * @param {Event} e
	     */
	    function onFocus(e) {
	      // Prevent IE from focusing the document or HTML element.
	      if (!isValidFocusTarget(e.target)) {
	        return;
	      }

	      if (hadKeyboardEvent || focusTriggersKeyboardModality(e.target)) {
	        addFocusVisibleClass(e.target);
	      }
	    }

	    /**
	     * On `blur`, remove the `focus-visible` class from the target.
	     * @param {Event} e
	     */
	    function onBlur(e) {
	      if (!isValidFocusTarget(e.target)) {
	        return;
	      }

	      if (
	        e.target.classList.contains('focus-visible') ||
	        e.target.hasAttribute('data-focus-visible-added')
	      ) {
	        // To detect a tab/window switch, we look for a blur event followed
	        // rapidly by a visibility change.
	        // If we don't see a visibility change within 100ms, it's probably a
	        // regular focus change.
	        hadFocusVisibleRecently = true;
	        window.clearTimeout(hadFocusVisibleRecentlyTimeout);
	        hadFocusVisibleRecentlyTimeout = window.setTimeout(function() {
	          hadFocusVisibleRecently = false;
	        }, 100);
	        removeFocusVisibleClass(e.target);
	      }
	    }

	    /**
	     * If the user changes tabs, keep track of whether or not the previously
	     * focused element had .focus-visible.
	     * @param {Event} e
	     */
	    function onVisibilityChange(e) {
	      if (document.visibilityState === 'hidden') {
	        // If the tab becomes active again, the browser will handle calling focus
	        // on the element (Safari actually calls it twice).
	        // If this tab change caused a blur on an element with focus-visible,
	        // re-apply the class when the user switches back to the tab.
	        if (hadFocusVisibleRecently) {
	          hadKeyboardEvent = true;
	        }
	        addInitialPointerMoveListeners();
	      }
	    }

	    /**
	     * Add a group of listeners to detect usage of any pointing devices.
	     * These listeners will be added when the polyfill first loads, and anytime
	     * the window is blurred, so that they are active when the window regains
	     * focus.
	     */
	    function addInitialPointerMoveListeners() {
	      document.addEventListener('mousemove', onInitialPointerMove);
	      document.addEventListener('mousedown', onInitialPointerMove);
	      document.addEventListener('mouseup', onInitialPointerMove);
	      document.addEventListener('pointermove', onInitialPointerMove);
	      document.addEventListener('pointerdown', onInitialPointerMove);
	      document.addEventListener('pointerup', onInitialPointerMove);
	      document.addEventListener('touchmove', onInitialPointerMove);
	      document.addEventListener('touchstart', onInitialPointerMove);
	      document.addEventListener('touchend', onInitialPointerMove);
	    }

	    function removeInitialPointerMoveListeners() {
	      document.removeEventListener('mousemove', onInitialPointerMove);
	      document.removeEventListener('mousedown', onInitialPointerMove);
	      document.removeEventListener('mouseup', onInitialPointerMove);
	      document.removeEventListener('pointermove', onInitialPointerMove);
	      document.removeEventListener('pointerdown', onInitialPointerMove);
	      document.removeEventListener('pointerup', onInitialPointerMove);
	      document.removeEventListener('touchmove', onInitialPointerMove);
	      document.removeEventListener('touchstart', onInitialPointerMove);
	      document.removeEventListener('touchend', onInitialPointerMove);
	    }

	    /**
	     * When the polfyill first loads, assume the user is in keyboard modality.
	     * If any event is received from a pointing device (e.g. mouse, pointer,
	     * touch), turn off keyboard modality.
	     * This accounts for situations where focus enters the page from the URL bar.
	     * @param {Event} e
	     */
	    function onInitialPointerMove(e) {
	      // Work around a Safari quirk that fires a mousemove on <html> whenever the
	      // window blurs, even if you're tabbing out of the page. ¯\_(ツ)_/¯
	      if (e.target.nodeName && e.target.nodeName.toLowerCase() === 'html') {
	        return;
	      }

	      hadKeyboardEvent = false;
	      removeInitialPointerMoveListeners();
	    }

	    // For some kinds of state, we are interested in changes at the global scope
	    // only. For example, global pointer input, global key presses and global
	    // visibility change should affect the state at every scope:
	    document.addEventListener('keydown', onKeyDown, true);
	    document.addEventListener('mousedown', onPointerDown, true);
	    document.addEventListener('pointerdown', onPointerDown, true);
	    document.addEventListener('touchstart', onPointerDown, true);
	    document.addEventListener('visibilitychange', onVisibilityChange, true);

	    addInitialPointerMoveListeners();

	    // For focus and blur, we specifically care about state changes in the local
	    // scope. This is because focus / blur events that originate from within a
	    // shadow root are not re-dispatched from the host element if it was already
	    // the active element in its own scope:
	    scope.addEventListener('focus', onFocus, true);
	    scope.addEventListener('blur', onBlur, true);

	    // We detect that a node is a ShadowRoot by ensuring that it is a
	    // DocumentFragment and also has a host property. This check covers native
	    // implementation and polyfill implementation transparently. If we only cared
	    // about the native implementation, we could just check if the scope was
	    // an instance of a ShadowRoot.
	    if (scope.nodeType === Node.DOCUMENT_FRAGMENT_NODE && scope.host) {
	      // Since a ShadowRoot is a special kind of DocumentFragment, it does not
	      // have a root element to add a class to. So, we add this attribute to the
	      // host element instead:
	      scope.host.setAttribute('data-js-focus-visible', '');
	    } else if (scope.nodeType === Node.DOCUMENT_NODE) {
	      document.documentElement.classList.add('js-focus-visible');
	      document.documentElement.setAttribute('data-js-focus-visible', '');
	    }
	  }

	  // It is important to wrap all references to global window and document in
	  // these checks to support server-side rendering use cases
	  // @see https://github.com/WICG/focus-visible/issues/199
	  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
	    // Make the polyfill helper globally available. This can be used as a signal
	    // to interested libraries that wish to coordinate with the polyfill for e.g.,
	    // applying the polyfill to a shadow root:
	    window.applyFocusVisiblePolyfill = applyFocusVisiblePolyfill;

	    // Notify interested libraries of the polyfill's presence, in case the
	    // polyfill was loaded lazily:
	    var event;

	    try {
	      event = new CustomEvent('focus-visible-polyfill-ready');
	    } catch (error) {
	      // IE11 does not support using CustomEvent as a constructor directly:
	      event = document.createEvent('CustomEvent');
	      event.initCustomEvent('focus-visible-polyfill-ready', false, false, {});
	    }

	    window.dispatchEvent(event);
	  }

	  if (typeof document !== 'undefined') {
	    // Apply the polyfill to the global document, so that no JavaScript
	    // coordination is required to use the polyfill in the top-level document:
	    applyFocusVisiblePolyfill(document);
	  }

	})));
	});

	// TODO: Beautify
	!(function () {
	  var e = document.querySelector(".js-toggle"),
	    t = document.querySelector(".js-details"),
	    o = t && t.querySelectorAll("a"),
	    n = function () {
	      e.removeEventListener("click", i, !1),
	        setTimeout(function () {
	          e.parentNode.removeChild(e);
	        }, 100),
	        t.classList.remove("is-invisible"),
	        t.removeEventListener("focus", n, !1),
	        [].forEach.call(o, function (e) {
	          e.setAttribute("tabindex", 0);
	        });
	    },
	    i = function () {
	      t.focus();
	    };
	  t &&
	    e &&
	    (t.setAttribute("tabindex", -1),
	    [].forEach.call(o, function (e) {
	      e.setAttribute("tabindex", -1);
	    }),
	    e.addEventListener("click", i, !1),
	    t.addEventListener("focus", n, !1));
	})();

}());
