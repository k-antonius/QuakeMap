// USGS URLs
// past day
var pastWeekSignificantQuakesURL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson";

// viewmodel for the map controls
 function ControlViewModel() {
   var self = this;
   self.earthquakes = ko.observableArray();
   // get earthquakes from feed
   $.getJSON(pastWeekSignificantQuakesURL, function(data) {
     for (var i = 0; i < data.features.length; i++) {
       self.earthquakes.push(data.features[i]);
     };
   });
}
 ko.applyBindings(new ControlViewModel());
