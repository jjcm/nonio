// via https://github.com/calebdwilliams/element-internals-polyfill
(function () {
    'use strict';

    const refMap = new WeakMap();
    const validityMap = new WeakMap();
    const hiddenInputMap = new WeakMap();
    const internalsMap = new WeakMap();
    const validationMessageMap = new WeakMap();
    const formsMap = new WeakMap();
    const shadowHostsMap = new WeakMap();
    const formElementsMap = new WeakMap();
    const refValueMap = new WeakMap();
    const upgradeMap = new WeakMap();
    const shadowRootMap = new WeakMap();
    const validationAnchorMap = new WeakMap();
    const documentFragmentMap = new WeakMap();
    const onSubmitMap = new WeakMap();

    const observerConfig$1 = { attributes: true, attributeFilter: ['disabled'] };
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            const target = mutation.target;
            if (target.constructor['formAssociated']) {
                const isDisabled = target.hasAttribute('disabled');
                target.toggleAttribute('internals-disabled', isDisabled);
                if (target.formDisabledCallback) {
                    target.formDisabledCallback.apply(target, [target.hasAttribute('disabled')]);
                }
            }
        }
    });
    const removeHiddenInputs = (internals) => {
        const hiddenInputs = hiddenInputMap.get(internals);
        hiddenInputs.forEach(hiddenInput => {
            hiddenInput.remove();
        });
        hiddenInputMap.set(internals, []);
    };
    const createHiddenInput = (ref, internals) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = ref.getAttribute('name');
        ref.after(input);
        hiddenInputMap.get(internals).push(input);
        return input;
    };
    const initRef = (ref, internals) => {
        hiddenInputMap.set(internals, []);
        const isDisabled = ref.hasAttribute('disabled');
        ref.toggleAttribute('internals-disabled', isDisabled);
        observer.observe(ref, observerConfig$1);
    };
    const initLabels = (ref, labels) => {
        if (labels.length) {
            Array.from(labels).forEach(label => label.addEventListener('click', ref.focus.bind(ref)));
            let firstLabelId = labels[0].id;
            if (!labels[0].id) {
                firstLabelId = `${labels[0].htmlFor}_Label`;
                labels[0].id = firstLabelId;
            }
            ref.setAttribute('aria-labelledby', firstLabelId);
        }
    };
    const formSubmitCallback = (event) => {
        const form = event.target;
        const elements = formElementsMap.get(form);
        if (elements.size) {
            const nodes = Array.from(elements);
            const validityList = nodes
                .reverse()
                .map(node => {
                const internals = internalsMap.get(node);
                return internals.reportValidity();
            });
            if (validityList.includes(false)) {
                event.stopImmediatePropagation();
                event.stopPropagation();
                event.preventDefault();
            }
            else if (onSubmitMap.get(form)) {
                const callback = onSubmitMap.get(form);
                const canceled = callback.call(form, event);
                if (canceled === false) {
                    event.preventDefault();
                }
            }
        }
    };
    const formResetCallback = (event) => {
        const elements = formElementsMap.get(event.target);
        if (elements && elements.size) {
            elements.forEach(element => {
                if (element.constructor.formAssociated && element.formResetCallback) {
                    element.formResetCallback.apply(element);
                }
            });
        }
    };
    const initForm = (ref, form, internals) => {
        if (form) {
            if (form.onsubmit) {
                onSubmitMap.set(form, form.onsubmit.bind(form));
                form.onsubmit = null;
            }
            const formElements = formElementsMap.get(form);
            if (formElements) {
                formElements.add(ref);
            }
            else {
                const initSet = new Set();
                initSet.add(ref);
                formElementsMap.set(form, initSet);
                form.addEventListener('submit', formSubmitCallback);
                form.addEventListener('reset', formResetCallback);
            }
            formsMap.set(form, { ref, internals });
            if (ref.constructor['formAssociated'] && ref.formAssociatedCallback) {
                setTimeout(() => {
                    ref.formAssociatedCallback.apply(ref, [form]);
                }, 0);
            }
        }
    };
    const findParentForm = (elem) => {
        let parent = elem.parentNode;
        if (parent && parent.tagName !== 'FORM') {
            parent = findParentForm(parent);
        }
        else if (!parent && elem.toString() === '[object ShadowRoot]') {
            parent = findParentForm(elem.host);
        }
        return parent;
    };
    const throwIfNotFormAssociated = (ref, message, ErrorType = DOMException) => {
        if (!ref.constructor['formAssociated']) {
            throw new ErrorType(message);
        }
    };
    const overrideFormMethod = (form, returnValue, method) => {
        const elements = formElementsMap.get(form);
        if (elements && elements.size) {
            elements.forEach(element => {
                const internals = internalsMap.get(element);
                const valid = internals[method]();
                if (!valid) {
                    returnValue = false;
                }
            });
        }
        return returnValue;
    };
    const upgradeInternals = (ref) => {
        if (ref.constructor['formAssociated']) {
            const internals = internalsMap.get(ref);
            const { labels, form } = internals;
            initLabels(ref, labels);
            initForm(ref, form, internals);
        }
    };

    const aom = {
        ariaAtomic: 'aria-atomic',
        ariaAutoComplete: 'aria-autocomplete',
        ariaBusy: 'aria-busy',
        ariaChecked: 'aria-checked',
        ariaColCount: 'aria-colcount',
        ariaColIndex: 'aria-colindex',
        ariaColSpan: 'aria-colspan',
        ariaCurrent: 'aria-current',
        ariaDisabled: 'aria-disabled',
        ariaExpanded: 'aria-expanded',
        ariaHasPopup: 'aria-haspopup',
        ariaHidden: 'aria-hidden',
        ariaKeyShortcuts: 'aria-keyshortcuts',
        ariaLabel: 'aria-label',
        ariaLevel: 'aria-level',
        ariaLive: 'aria-live',
        ariaModal: 'aria-modal',
        ariaMultiLine: 'aria-multiline',
        ariaMultiSelectable: 'aria-multiselectable',
        ariaOrientation: 'aria-orientation',
        ariaPlaceholder: 'aria-placeholder',
        ariaPosInSet: 'aria-posinset',
        ariaPressed: 'aria-pressed',
        ariaReadOnly: 'aria-readonly',
        ariaRelevant: 'aria-relevant',
        ariaRequired: 'aria-required',
        ariaRoleDescription: 'aria-roledescription',
        ariaRowCount: 'aria-rowcount',
        ariaRowIndex: 'aria-rowindex',
        ariaRowSpan: 'aria-rowspan',
        ariaSelected: 'aria-selected',
        ariaSetSize: 'aria-setsize',
        ariaSort: 'aria-sort',
        ariaValueMax: 'aria-valuemax',
        ariaValueMin: 'aria-valuemin',
        ariaValueNow: 'aria-valuenow',
        ariaValueText: 'aria-valuetext',
        role: 'role'
    };
    const initAom = (ref, internals) => {
        for (let key in aom) {
            internals[key] = null;
            let closureValue = null;
            const attributeName = aom[key];
            Object.defineProperty(internals, key, {
                get() {
                    return closureValue;
                },
                set(value) {
                    closureValue = value;
                    if (ref.isConnected) {
                        ref.setAttribute(attributeName, value);
                    }
                    else {
                        upgradeMap.set(ref, internals);
                    }
                }
            });
        }
    };

    class ValidityState {
        badInput = false;
        customError = false;
        patternMismatch = false;
        rangeOverflow = false;
        rangeUnderflow = false;
        stepMismatch = false;
        tooLong = false;
        tooShort = false;
        typeMismatch = false;
        valid = true;
        valueMissing = false;
        constructor() {
            Object.seal(this);
        }
    }
    const setValid = (validityObject) => {
        validityObject.badInput = false;
        validityObject.customError = false;
        validityObject.patternMismatch = false;
        validityObject.rangeOverflow = false;
        validityObject.rangeUnderflow = false;
        validityObject.stepMismatch = false;
        validityObject.tooLong = false;
        validityObject.tooShort = false;
        validityObject.typeMismatch = false;
        validityObject.valid = true;
        validityObject.valueMissing = false;
        return validityObject;
    };
    const reconcileValidity = (validityObject, newState) => {
        validityObject.valid = isValid(newState);
        Object.keys(newState).forEach(key => validityObject[key] = newState[key]);
        return validityObject;
    };
    const isValid = (validityState) => {
        let valid = true;
        for (let key in validityState) {
            if (key !== 'valid' && validityState[key] !== false) {
                valid = false;
            }
        }
        return valid;
    };

    function observerCallback(mutationList) {
        mutationList.forEach(mutationRecord => {
            const { addedNodes, removedNodes } = mutationRecord;
            const added = Array.from(addedNodes);
            const removed = Array.from(removedNodes);
            added.forEach(node => {
                if (internalsMap.has(node) && node.constructor['formAssociated']) {
                    const internals = internalsMap.get(node);
                    const { form } = internals;
                    initForm(node, form, internals);
                    initLabels(node, internals.labels);
                }
                if (upgradeMap.has(node)) {
                    const internals = upgradeMap.get(node);
                    const aomKeys = Object.keys(aom);
                    aomKeys
                        .filter(key => internals[key] !== null)
                        .forEach(key => {
                        node.setAttribute(aom[key], internals[key]);
                    });
                    upgradeMap.delete(node);
                }
            });
            removed.forEach(node => {
                const internals = internalsMap.get(node);
                if (internals && hiddenInputMap.get(internals)) {
                    removeHiddenInputs(internals);
                }
                if (shadowHostsMap.has(node)) {
                    const observer = shadowHostsMap.get(node);
                    observer.disconnect();
                }
            });
        });
    }
    function fragmentObserverCallback(mutationList) {
        mutationList.forEach(mutation => {
            const { removedNodes } = mutation;
            removedNodes.forEach(node => {
                const observer = documentFragmentMap.get(mutation.target);
                if (internalsMap.has(node)) {
                    upgradeInternals(node);
                }
                observer.disconnect();
            });
        });
    }
    const deferUpgrade = (fragment) => {
        const observer = new MutationObserver(fragmentObserverCallback);
        observer.observe(fragment, { childList: true });
        documentFragmentMap.set(fragment, observer);
    };
    new MutationObserver(observerCallback);
    const observerConfig = {
        childList: true,
        subtree: true
    };

    const customStateMap = new WeakMap();
    class CustomStateSet extends Set {
        constructor(ref) {
            super();
            if (!ref || !ref.tagName || ref.tagName.indexOf('-') === -1) {
                throw new TypeError('Illegal constructor');
            }
            customStateMap.set(this, ref);
        }
        add(state) {
            if (!/^--/.exec(state) || typeof state !== 'string') {
                throw new DOMException(`Failed to execute 'add' on 'CustomStateSet': The specified value ${state} must start with '--'.`);
            }
            const result = super.add(state);
            const ref = customStateMap.get(this);
            ref.toggleAttribute(`state${state}`, true);
            return result;
        }
        clear() {
            for (let [entry] of this.entries()) {
                this.delete(entry);
            }
            super.clear();
        }
        delete(state) {
            const result = super.delete(state);
            const ref = customStateMap.get(this);
            ref.toggleAttribute(`state${state}`, false);
            return result;
        }
    }

    class ElementInternals {
        ariaAtomic;
        ariaAutoComplete;
        ariaBusy;
        ariaChecked;
        ariaColCount;
        ariaColIndex;
        ariaColSpan;
        ariaCurrent;
        ariaDisabled;
        ariaExpanded;
        ariaHasPopup;
        ariaHidden;
        ariaKeyShortcuts;
        ariaLabel;
        ariaLevel;
        ariaLive;
        ariaModal;
        ariaMultiLine;
        ariaMultiSelectable;
        ariaOrientation;
        ariaPlaceholder;
        ariaPosInSet;
        ariaPressed;
        ariaReadOnly;
        ariaRelevant;
        ariaRequired;
        ariaRoleDescription;
        ariaRowCount;
        ariaRowIndex;
        ariaRowSpan;
        ariaSelected;
        ariaSetSize;
        ariaSort;
        ariaValueMax;
        ariaValueMin;
        ariaValueNow;
        ariaValueText;
        role;
        states;
        static get isPolyfilled() {
            return true;
        }
        constructor(ref) {
            if (!ref || !ref.tagName || ref.tagName.indexOf('-') === -1) {
                throw new TypeError('Illegal constructor');
            }
            const rootNode = ref.getRootNode();
            const validity = new ValidityState();
            this.states = new CustomStateSet(ref);
            refMap.set(this, ref);
            validityMap.set(this, validity);
            internalsMap.set(ref, this);
            initAom(ref, this);
            initRef(ref, this);
            Object.seal(this);
            upgradeInternals(ref);
            if (rootNode instanceof DocumentFragment) {
                deferUpgrade(rootNode);
            }
        }
        checkValidity() {
            const ref = refMap.get(this);
            throwIfNotFormAssociated(ref, `Failed to execute 'checkValidity' on 'ElementInternals': The target element is not a form-associated custom element.`);
            const validity = validityMap.get(this);
            if (!validity.valid) {
                const validityEvent = new Event('invalid', {
                    bubbles: false,
                    cancelable: true,
                    composed: false
                });
                ref.dispatchEvent(validityEvent);
            }
            return validity.valid;
        }
        get form() {
            const ref = refMap.get(this);
            throwIfNotFormAssociated(ref, `Failed to read the 'form' property from 'ElementInternals': The target element is not a form-associated custom element.`);
            let form;
            if (ref.constructor['formAssociated'] === true) {
                form = findParentForm(ref);
            }
            return form;
        }
        get labels() {
            const ref = refMap.get(this);
            throwIfNotFormAssociated(ref, `Failed to read the 'labels' property from 'ElementInternals': The target element is not a form-associated custom element.`);
            const id = ref.getAttribute('id');
            const hostRoot = ref.getRootNode();
            if (hostRoot && id) {
                return hostRoot ? hostRoot.querySelectorAll(`[for=${id}]`) : [];
            }
            return [];
        }
        reportValidity() {
            const ref = refMap.get(this);
            throwIfNotFormAssociated(ref, `Failed to execute 'reportValidity' on 'ElementInternals': The target element is not a form-associated custom element.`);
            const valid = this.checkValidity();
            const anchor = validationAnchorMap.get(this);
            if (anchor && !ref.constructor['formAssociated']) {
                throw new DOMException(`Failed to execute 'setValidity' on 'ElementInternals': The target element is not a form-associated custom element.`);
            }
            if (!valid && anchor) {
                ref.focus();
                anchor.focus();
            }
            return valid;
        }
        setFormValue(value) {
            const ref = refMap.get(this);
            throwIfNotFormAssociated(ref, `Failed to execute 'setFormValue' on 'ElementInternals': The target element is not a form-associated custom element.`);
            removeHiddenInputs(this);
            if (value != null && !(value instanceof FormData)) {
                if (ref.getAttribute('name')) {
                    const hiddenInput = createHiddenInput(ref, this);
                    hiddenInput.value = value;
                }
            }
            else if (value != null && value instanceof FormData) {
                value.forEach((formDataValue, formDataKey) => {
                    if (typeof formDataValue === 'string') {
                        const hiddenInput = createHiddenInput(ref, this);
                        hiddenInput.name = formDataKey;
                        hiddenInput.value = formDataValue;
                    }
                });
            }
            refValueMap.set(ref, value);
        }
        setValidity(validityChanges, validationMessage, anchor) {
            const ref = refMap.get(this);
            throwIfNotFormAssociated(ref, `Failed to execute 'setValidity' on 'ElementInternals': The target element is not a form-associated custom element.`);
            if (!validityChanges) {
                throw new TypeError('Failed to execute \'setValidity\' on \'ElementInternals\': 1 argument required, but only 0 present.');
            }
            validationAnchorMap.set(this, anchor);
            const validity = validityMap.get(this);
            const validityChangesObj = {};
            for (const key in validityChanges) {
                validityChangesObj[key] = validityChanges[key];
            }
            if (Object.keys(validityChangesObj).length === 0) {
                setValid(validity);
            }
            const check = { ...validity, ...validityChangesObj };
            delete check.valid;
            const { valid } = reconcileValidity(validity, check);
            if (!valid && !validationMessage) {
                throw new DOMException(`Failed to execute 'setValidity' on 'ElementInternals': The second argument should not be empty if one or more flags in the first argument are true.`);
            }
            validationMessageMap.set(this, valid ? '' : validationMessage);
            ref.toggleAttribute('internals-invalid', !valid);
            ref.toggleAttribute('internals-valid', valid);
            ref.setAttribute('aria-invalid', `${!valid}`);
        }
        get shadowRoot() {
            const ref = refMap.get(this);
            const shadowRoot = shadowRootMap.get(ref);
            if (shadowRoot) {
                return shadowRootMap.get(ref);
            }
            return null;
        }
        get validationMessage() {
            const ref = refMap.get(this);
            throwIfNotFormAssociated(ref, `Failed to read the 'validationMessage' property from 'ElementInternals': The target element is not a form-associated custom element.`);
            return validationMessageMap.get(this);
        }
        get validity() {
            const ref = refMap.get(this);
            throwIfNotFormAssociated(ref, `Failed to read the 'validity' property from 'ElementInternals': The target element is not a form-associated custom element.`);
            const validity = validityMap.get(this);
            return validity;
        }
        get willValidate() {
            const ref = refMap.get(this);
            throwIfNotFormAssociated(ref, `Failed to read the 'willValidate' property from 'ElementInternals': The target element is not a form-associated custom element.`);
            if (ref.disabled || ref.hasAttribute('disabled')) {
                return false;
            }
            return true;
        }
    }
    if (!window.CustomStateSet) {
        window.CustomStateSet = CustomStateSet;
    }
    function isElementInternalsSupported() {
        if (!window.ElementInternals) {
            return false;
        }
        class ElementInternalsFeatureDetection extends HTMLElement {
            internals;
            constructor() {
                super();
                this.internals = this.attachInternals();
            }
        }
        const randomName = `element-internals-feature-detection-${Math.random().toString(36).replace(/[^a-z]+/g, '')}`;
        customElements.define(randomName, ElementInternalsFeatureDetection);
        const featureDetectionElement = new ElementInternalsFeatureDetection();
        return [
            "shadowRoot",
            "form",
            "states",
            "willValidate",
            "validity",
            "validationMessage",
            "labels",
            "setFormValue",
            "setValidity",
            "checkValidity",
            "reportValidity"
        ].every(prop => prop in featureDetectionElement.internals);
    }
    if (!isElementInternalsSupported()) {
        window.ElementInternals = ElementInternals;
        function attachShadowObserver(...args) {
            const shadowRoot = attachShadow.apply(this, args);
            const observer = new MutationObserver(observerCallback);
            shadowRootMap.set(this, shadowRoot);
            observer.observe(shadowRoot, observerConfig);
            shadowHostsMap.set(this, observer);
            return shadowRoot;
        }
        function checkValidityOverride(...args) {
            let returnValue = checkValidity.apply(this, args);
            return overrideFormMethod(this, returnValue, 'checkValidity');
        }
        function reportValidityOverride(...args) {
            let returnValue = reportValidity.apply(this, args);
            return overrideFormMethod(this, returnValue, 'reportValidity');
        }
        Object.defineProperty(HTMLElement.prototype, 'attachInternals', {
            get() {
                return () => {
                    if (this.tagName.indexOf('-') === -1) {
                        throw new Error(`Failed to execute 'attachInternals' on 'HTMLElement': Unable to attach ElementInternals to non-custom elements.`);
                    }
                    return new ElementInternals(this);
                };
            }
        });
        const attachShadow = Element.prototype.attachShadow;
        Element.prototype.attachShadow = attachShadowObserver;
        const documentObserver = new MutationObserver(observerCallback);
        documentObserver.observe(document.documentElement, observerConfig);
        const checkValidity = HTMLFormElement.prototype.checkValidity;
        HTMLFormElement.prototype.checkValidity = checkValidityOverride;
        const reportValidity = HTMLFormElement.prototype.reportValidity;
        HTMLFormElement.prototype.reportValidity = reportValidityOverride;
    }

}());
