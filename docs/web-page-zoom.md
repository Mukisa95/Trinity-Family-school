# Web page pinch zoom

Desktop trackpad pinches and touchscreen pinches use the browser's page zoom, including when the gesture starts over the in-app PDF canvas. The entire interface enlarges together. PDF document zoom remains available through its explicit controls.

## Changes

- The root viewport explicitly allows user scaling, without a maximum-scale restriction.
- Mobile page surfaces allow native panning and pinch zoom. Timetable grids, the header's scrolling popover and the notification panel retain their scrolling directions and also permit pinch zoom.
- The web timetable no longer captures two-finger gestures for its internal grid zoom. The existing Android-native timetable gesture remains in place.
- The PDF viewer leaves Ctrl/Cmd + plus, minus and zero to the browser. Its search shortcut and document zoom buttons continue to work.
- The PDF gesture handler captures pinch and wheel zoom only inside the Android app; browser gestures remain available over the PDF canvas.
- Main-page and mobile-sidebar swipe handlers share a one-finger recognizer. Multi-touch, cancelled touches and panning an already zoomed page cannot open or close a sidebar.

There is no custom CSS scaling or global wheel/touch interception. Browsers retain their own zoom limits and gesture settings. Dedicated drag controls, such as editor handles and sliders, keep their existing gesture behavior.

## Validation

`scripts/test-page-zoom-browser.cjs` uses the real PDF workspace, PDF.js canvas rendering, application CSS and shared swipe hook with synthetic school content. It exercises Chromium through CDP, including trackpad-style pinch input and raw two-finger touchscreen input.

- Desktop trackpad and desktop touchscreen gestures increase the page's visual viewport scale.
- Mobile touchscreen gestures zoom in and out, including over a nested scrolling surface and the PDF canvas.
- Browser page zoom leaves the PDF's internal zoom value and rendered canvas pixels/dimensions unchanged.
- Standard browser zoom key events remain uncancelled, PDF search works, and the PDF's explicit zoom buttons still change document zoom.
- Single-finger swipe recognition resumes after zoom is reset; pinches, cancelled gestures and zoomed-page panning do not trigger it.
- The existing PDF theme regression passes, including identical original PDF bytes, print source, PNG export and page/thumbnail pixels.

Screenshots and logs are under `output/page-zoom-qa/`. These are QA artifacts. No physical Windows touchscreen, Mac trackpad or iPhone was used; the checks above are browser automation.

Browser references: [touch-action and native pinch zoom](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [trackpad zoom wheel events](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event), [Next.js viewport configuration](https://nextjs.org/docs/app/api-reference/functions/generate-viewport).
