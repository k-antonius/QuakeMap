Earthquake Data Viewer
======================
This web app uses Google Map to display information about recent earthquakes
from USGS.gov.

Setup
-----
1. Dependencies: jQuery and Knockout.js (provided).
2. Clone or download the repository and open index.html in a browser.

Using the Application
---------------------
There are three UI areas.
1. A control bar with two drop-down menus and a "Show Detail" button.

The drop down menus control the earthquakes that are displayed. The leftmost
filters earthquakes of a magnitude less than that selected. The rightmost
controls the time horizon of the earthquakes displayed, for example, to show
only earthquakes that occurred within the last week, select "week."

The "Show Detail" button will zoom the map in to focus the earthquake that
is selected in the list view area (see below). Once the map has zoomed in a
new marker will drop in, marking a nearby location, which is referred to in the
title of the earthquake. Clicking on this new marker will display available
articles from Wikipedia about that location.

2. Earthquake List View.

Below the control bar a list view is displayed of the earthquakes currently
visible in the map viewport. This list will grow and shrink as the map view
is panned and zoomed. Clicking on one of the listed earthquake titles will
highlight it and display more information about the earthquake.
The user may then click the "Show Detail" button as described above.
Clicking on the same title again will unselect it.

3. Google Map Viewer.

Finally, all currently loaded earthquakes are displayed with markers in the
Google Map window below/next to the control area. If an earthquake is selected
in the list area, all unselected earthquake markers will become transparent.

Clicking on any marker will display additional information about it.

Credits
-------
Earthquake information provided by [USGS.gov.](https://earthquake.usgs.gov/earthquakes/).

Place information provided by [Wikipedia](www.wikipedia.org).

Google Maps and Geolocation APIs provided by Google.
