const DANGEROUS_PREVIEW_SELECTOR = 'script, iframe, object, embed';
const DANGEROUS_PREVIEW_URL_ATTRIBUTES = ['src', 'href'] as const;
const DANGEROUS_PREVIEW_URL_PROTOCOLS = ['javascript:', 'vbscript:', 'file:'];
const DANGEROUS_PREVIEW_DATA_PROTOCOL = 'data:';
const DANGEROUS_PREVIEW_DATA_IMAGE_PREFIX = 'data:image/';
const DANGEROUS_PREVIEW_ATTRIBUTE_NAMES = ['srcdoc'] as const;
const DANGEROUS_PREVIEW_ATTRIBUTE_PREFIXES = ['on'] as const;

const includesAttribute = (values: readonly string[], attributeName: string) => values.includes(attributeName);

const isDangerousUrlValue = (attributeName: string, attributeValue: string) => {
  if (!includesAttribute(DANGEROUS_PREVIEW_URL_ATTRIBUTES, attributeName)) {
    return false;
  }

  if (attributeValue.startsWith(DANGEROUS_PREVIEW_DATA_PROTOCOL)) {
    return !attributeValue.startsWith(DANGEROUS_PREVIEW_DATA_IMAGE_PREFIX);
  }

  return DANGEROUS_PREVIEW_URL_PROTOCOLS.some((protocol) => attributeValue.startsWith(protocol));
};

const shouldRemovePreviewAttribute = (attributeName: string, attributeValue: string) => {
  if (
    DANGEROUS_PREVIEW_ATTRIBUTE_PREFIXES.some((prefix) => attributeName.startsWith(prefix)) ||
    includesAttribute(DANGEROUS_PREVIEW_ATTRIBUTE_NAMES, attributeName)
  ) {
    return true;
  }

  return isDangerousUrlValue(attributeName, attributeValue);
};

const removeDangerousPreviewAttribute = (element: Element, attribute: Attr) => {
  const attributeName = attribute.name.toLowerCase();
  const attributeValue = attribute.value.trim().toLowerCase();

  if (shouldRemovePreviewAttribute(attributeName, attributeValue)) {
    element.removeAttribute(attribute.name);
  }
};

export const sanitizeElementTree = (root: ParentNode) => {
  root.querySelectorAll(DANGEROUS_PREVIEW_SELECTOR).forEach((element) => {
    element.remove();
  });

  root.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      removeDangerousPreviewAttribute(element, attribute);
    });
  });
};

export const STREAM_SANITIZER_SCRIPT = `
  const dangerousSelector = ${JSON.stringify(DANGEROUS_PREVIEW_SELECTOR)};
  const dangerousUrlAttributes = ${JSON.stringify(DANGEROUS_PREVIEW_URL_ATTRIBUTES)};
  const dangerousUrlProtocols = ${JSON.stringify(DANGEROUS_PREVIEW_URL_PROTOCOLS)};
  const dangerousDataProtocol = ${JSON.stringify(DANGEROUS_PREVIEW_DATA_PROTOCOL)};
  const dangerousDataImagePrefix = ${JSON.stringify(DANGEROUS_PREVIEW_DATA_IMAGE_PREFIX)};
  const dangerousAttributeNames = ${JSON.stringify(DANGEROUS_PREVIEW_ATTRIBUTE_NAMES)};
  const dangerousAttributePrefixes = ${JSON.stringify(DANGEROUS_PREVIEW_ATTRIBUTE_PREFIXES)};

  const isDangerousUrlValue = (attributeName, attributeValue) => {
    if (!dangerousUrlAttributes.includes(attributeName)) {
      return false;
    }

    if (attributeValue.startsWith(dangerousDataProtocol)) {
      return !attributeValue.startsWith(dangerousDataImagePrefix);
    }

    return dangerousUrlProtocols.some((protocol) => attributeValue.startsWith(protocol));
  };

  const shouldRemoveAttribute = (attributeName, attributeValue) => {
    if (
      dangerousAttributePrefixes.some((prefix) => attributeName.startsWith(prefix)) ||
      dangerousAttributeNames.includes(attributeName)
    ) {
      return true;
    }

    return isDangerousUrlValue(attributeName, attributeValue);
  };

  const sanitizeElementTree = (parent) => {
    parent.querySelectorAll(dangerousSelector).forEach((element) => element.remove());
    parent.querySelectorAll('*').forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        const attributeName = attribute.name.toLowerCase();
        const attributeValue = attribute.value.trim().toLowerCase();

        if (shouldRemoveAttribute(attributeName, attributeValue)) {
          element.removeAttribute(attribute.name);
        }
      });
    });
  };
`;
