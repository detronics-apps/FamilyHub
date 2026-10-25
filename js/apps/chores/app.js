// Chores as a mini-app. It is a starter app that predates the platform: its
// data is part of the household (definitions, history, people, rooms), so it
// uses the first-party `household:chores` permission and receives the core
// context through hub.core. New mini-apps use hub.data instead.

import { choresView } from './screens.js';

export function render(hub, route, notices) {
  return choresView(hub.core, route, notices);
}
