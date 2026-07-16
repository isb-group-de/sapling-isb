import { ENTITY_REGISTRY } from '../entity/global/entity.registry';
import { buildRootEntityExample } from './generic-entity-swagger.examples';
import type {
  EntityRegistryEntry,
  SwaggerDocument,
} from './generic-entity-swagger.types';

const GENERIC_ENTITY_COLLECTION_PATH = '/api/generic/{entityHandle}';
const GENERIC_ENTITY_DOWNLOAD_PATH = '/api/generic/{entityHandle}/download';

export function buildGenericEntitySwaggerUiScript(
  document: SwaggerDocument,
): string {
  const schemas = document.components?.schemas;
  if (!schemas) {
    return '';
  }

  const entityRegistry = ENTITY_REGISTRY as EntityRegistryEntry[];
  const entitySchemaMap = Object.fromEntries(
    entityRegistry
      .filter((entry) => schemas[entry.class.name])
      .map((entry) => [entry.name, entry.class.name]),
  );

  const requestExamples = Object.fromEntries(
    entityRegistry
      .filter((entry) => schemas[entry.class.name])
      .map((entry) => [
        entry.name,
        buildRootEntityExample(entry.class.name, schemas, 'request'),
      ]),
  );

  return `
(function () {
  const GENERIC_ENTITY_COLLECTION_PATH = '${GENERIC_ENTITY_COLLECTION_PATH}';
  const GENERIC_ENTITY_DOWNLOAD_PATH = '${GENERIC_ENTITY_DOWNLOAD_PATH}';
  const ENTITY_SCHEMA_MAP = ${JSON.stringify(entitySchemaMap)};
  const REQUEST_EXAMPLES = ${JSON.stringify(requestExamples)};
  const REQUEST_EXAMPLE_KEYS = Object.keys(REQUEST_EXAMPLES);

  function normalize(value) {
    return String(value ?? '').trim();
  }

  function getOperationPath(block) {
    const pathElement = block.querySelector('.opblock-summary-path');
    return normalize(pathElement && pathElement.textContent);
  }

  function isSupportedGenericOperation(block) {
    const path = getOperationPath(block);
    return (
      path === GENERIC_ENTITY_COLLECTION_PATH ||
      path === GENERIC_ENTITY_DOWNLOAD_PATH
    );
  }

  function getParameterControl(block, parameterName) {
    const parameterLabels = block.querySelectorAll('.parameter__name');

    for (const label of parameterLabels) {
      if (normalize(label.textContent).startsWith(parameterName)) {
        const row =
          label.closest('tr') ||
          label.closest('.parameters-col_description') ||
          label.parentElement;

        if (!row) {
          continue;
        }

        const control = row.querySelector('select, input, textarea');
        if (control) {
          return control;
        }
      }
    }

    return null;
  }

  function dispatchControlChange(control) {
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findRequestExampleKey(value) {
    const normalized = normalize(value);
    if (REQUEST_EXAMPLES[normalized]) {
      return normalized;
    }

    return (
      REQUEST_EXAMPLE_KEYS.find(
        (key) => normalized === normalize(key + ' request example'),
      ) || ''
    );
  }

  function syncMatchingSelects(block, entityHandle) {
    const selects = block.querySelectorAll('select');

    for (const select of selects) {
      const matchingOption = Array.from(select.options).find(
        (option) =>
          normalize(option.value) === entityHandle ||
          normalize(option.textContent) === entityHandle,
      );

      if (matchingOption && select.value !== matchingOption.value) {
        select.value = matchingOption.value;
        dispatchControlChange(select);
      }
    }
  }

  function syncRequestExampleSelects(block, entityControl, entityHandle) {
    const selectors = block.querySelectorAll('select');

    for (const selector of selectors) {
      if (!isRequestExampleSelector(selector, entityControl)) {
        continue;
      }

      const matchingOption = Array.from(selector.options).find(
        (option) =>
          findRequestExampleKey(option.value) === entityHandle ||
          findRequestExampleKey(option.textContent) === entityHandle,
      );

      if (matchingOption && selector.value !== matchingOption.value) {
        selector.value = matchingOption.value;
        dispatchControlChange(selector);
      }
    }
  }

  function isRequestExampleSelector(selector, entityControl) {
    if (selector === entityControl) {
      return false;
    }

    return Array.from(selector.options).some(
      (option) =>
        findRequestExampleKey(option.value) ||
        findRequestExampleKey(option.textContent),
    );
  }

  function getSelectedRequestExampleKey(selector) {
    const selectedOption =
      selector.selectedOptions && selector.selectedOptions[0];
    const candidates = [
      selector.value,
      selectedOption && selectedOption.value,
      selectedOption && selectedOption.textContent,
    ];

    for (const candidate of candidates) {
      const exampleKey = findRequestExampleKey(candidate);
      if (exampleKey) {
        return exampleKey;
      }
    }

    return '';
  }

  function getRequestExampleKey(block, entityHandle, entityControl) {
    const selectors = block.querySelectorAll('select');

    for (const selector of selectors) {
      if (!isRequestExampleSelector(selector, entityControl)) {
        continue;
      }

      const selectedExampleKey = getSelectedRequestExampleKey(selector);
      if (selectedExampleKey) {
        return selectedExampleKey;
      }
    }

    return entityHandle;
  }

  function getRequestEditor(block) {
    return block.querySelector('.body-param textarea, textarea');
  }

  function syncModelSelectors(block, entityHandle) {
    const schemaName = ENTITY_SCHEMA_MAP[entityHandle];
    if (!schemaName) {
      return;
    }

    const selectors = block.querySelectorAll(
      'select.model-box-control, .model-box-control select',
    );

    for (const selector of selectors) {
      const matchingOption = Array.from(selector.options).find(
        (option) =>
          normalize(option.value) === schemaName ||
          normalize(option.textContent) === schemaName ||
          normalize(option.value) === entityHandle ||
          normalize(option.textContent) === entityHandle,
      );

      if (matchingOption && selector.value !== matchingOption.value) {
        selector.value = matchingOption.value;
        dispatchControlChange(selector);
      }
    }
  }

  function syncRequestEditor(block, exampleKey) {
    const requestExample = REQUEST_EXAMPLES[exampleKey];
    if (!requestExample) {
      return;
    }

    const requestEditor = getRequestEditor(block);
    if (!requestEditor) {
      return;
    }

    if (
      block.dataset.saplingRequestExampleLoaded === exampleKey &&
      requestEditor.dataset.saplingRequestExampleLoaded === exampleKey
    ) {
      return;
    }

    const serialized = JSON.stringify(requestExample, null, 2);
    if (requestEditor.value !== serialized) {
      requestEditor.value = serialized;
      dispatchControlChange(requestEditor);
    }

    block.dataset.saplingRequestExampleLoaded = exampleKey;
    requestEditor.dataset.saplingRequestExampleLoaded = exampleKey;
  }

  function syncGenericOperation(block) {
    const entityControl = getParameterControl(block, 'entityHandle');
    if (!entityControl) {
      return;
    }

    const entityHandle = normalize(entityControl.value);
    if (!entityHandle) {
      return;
    }

    const entityChanged =
      block.dataset.saplingCurrentEntityHandle !== entityHandle;

    if (entityChanged) {
      syncMatchingSelects(block, entityHandle);
      syncRequestExampleSelects(block, entityControl, entityHandle);
      syncModelSelectors(block, entityHandle);
    }

    block.dataset.saplingCurrentEntityHandle = entityHandle;

    if (getOperationPath(block) === GENERIC_ENTITY_COLLECTION_PATH) {
      const exampleKey = getRequestExampleKey(block, entityHandle, entityControl);
      syncRequestEditor(block, exampleKey);
    }
  }

  function bindRequestExampleSelectors(block, entityControl, entityHandle) {
    const selectors = block.querySelectorAll('select');

    for (const selector of selectors) {
      if (
        !isRequestExampleSelector(selector, entityControl) ||
        selector.dataset.saplingRequestExampleBound === 'true'
      ) {
        continue;
      }

      const matchingOption = Array.from(selector.options).find(
        (option) =>
          findRequestExampleKey(option.value) === entityHandle ||
          findRequestExampleKey(option.textContent) === entityHandle,
      );

      if (matchingOption && selector.value !== matchingOption.value) {
        selector.value = matchingOption.value;
        dispatchControlChange(selector);
      }

      const onRequestExampleChange = function () {
        window.setTimeout(function () {
          syncGenericOperation(block);
        }, 0);
      };

      selector.addEventListener('change', onRequestExampleChange);
      selector.dataset.saplingRequestExampleBound = 'true';
    }
  }

  function bindGenericOperation(block) {
    const entityControl = getParameterControl(block, 'entityHandle');
    if (!entityControl) {
      return;
    }

    const entityHandle = normalize(entityControl.value);
    if (!entityHandle) {
      return;
    }

    bindRequestExampleSelectors(block, entityControl, entityHandle);

    if (block.dataset.saplingEntitySwaggerBound === 'true') {
      syncGenericOperation(block);
      return;
    }

    const onEntityChange = function () {
      window.setTimeout(function () {
        syncGenericOperation(block);
      }, 0);
    };

    entityControl.addEventListener('input', onEntityChange);
    entityControl.addEventListener('change', onEntityChange);
    block.dataset.saplingEntitySwaggerBound = 'true';
    syncGenericOperation(block);
  }

  function bindAllGenericOperations() {
    const blocks = document.querySelectorAll('.opblock');

    for (const block of blocks) {
      if (isSupportedGenericOperation(block)) {
        bindGenericOperation(block);
      }
    }
  }

  const observer = new MutationObserver(function () {
    bindAllGenericOperations();
  });

  function start() {
    bindAllGenericOperations();

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    window.setInterval(bindAllGenericOperations, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
  `.trim();
}
