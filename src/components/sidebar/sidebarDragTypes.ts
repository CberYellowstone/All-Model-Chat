/**
 * The drag data type used to carry a session id during a sidebar session drag.
 * `setData('sessionId', ...)` is normalized by the spec to lowercase ASCII, so
 * the DataTransfer type is `'sessionid'`, not `'sessionId'`. Keep the payload
 * and the guard checking this constant in lockstep.
 */
export const SESSION_DRAG_TYPE = 'sessionid';

/**
 * True when the drag being hovered/entered carries a session id — i.e. a real
 * sidebar session drag, not a file drag (which must be allowed to bubble to the
 * App root's upload handling) or some other arbitrary drag.
 */
export const isSessionDrag = (event: { dataTransfer: DataTransfer }): boolean =>
  event.dataTransfer.types.includes(SESSION_DRAG_TYPE);
