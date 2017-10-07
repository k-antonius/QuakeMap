var map;

// viewmodel for the map controls
function ControlViewModel() {
  var self = this;
  self.loadedQuakes = [];
  self.visibleQuakes = ko.observableArray();

  // types of available earthquake feeds from USGS.gov
  self.feedTypes = ["significant", "4.5", "2.5", "1.0", "all"];
  self.feedTimeHorizons = ["hour", "day", "week", "month"];
  
  // use significant and week as default feed when app loads
  self.curFeedType = ko.observable("significant");
  self.curFeedTimeHorizon = ko.observable("week");

  // predicate helper function
  function isQuakeOnMap(earthQuake) {
    let latLng = earthQuake.geometry.coordinates;
    return boundsLatLng.contains({lat: latLng[1], lng: latLng[0]});
  }

  // method that removes quakes from observable array as map bounds
  // change
  self.updateVisibleQuakes = function updateVisibleQuakes() {
    self.visibleQuakes(self.loadedQuakes.filter(isQuakeOnMap));
  }

  // Generate a url for the desired earthquake feed
  self.generateFeedUrl = function() {
   let baseFeedUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${self.curFeedType()}_${self.curFeedTimeHorizon()}.geojson`;
   return baseFeedUrl;
  }

  // the quake to be displayed in viewing area
  self.currentQuake = ko.observable(false);

  self.setCurrentQuake = function(earthQuakeJSON) {
   self.currentQuake(earthQuakeJSON);
  }

  // marker appears on map when earthquake title is clicked
  self.currentQuake.subscribe(()=> {
    var latLng = self.currentQuake().geometry.coordinates;
    new google.maps.Marker({
      position: {lat: latLng[1], lng: latLng[0]},
      map: map
    });
  });

  // get earthquakes from feed
  self.getQuakeFeed = function() {
    $.getJSON(self.generateFeedUrl(), function(data) {
      self.loadedQuakes = [];
      for (var i = 0; i < data.features.length; i++) {
       self.loadedQuakes.push(data.features[i]);
      };
    });
  }

  // update the feed when either select menu changes
  self.curFeedType.subscribe(self.getQuakeFeed, null);
  self.curFeedTimeHorizon.subscribe(self.getQuakeFeed, null);
  // call for inital setup
  self.getQuakeFeed();

}

// instatiate before passing to applyBindings so that
// methods are available to initMap function
var controlViewModel = new ControlViewModel();

// create a new Google Map
function initMap() {
  map = new google.maps.Map(document.getElementById('map_container'), {
    center: {lat: 0, lng: 0},
    zoom: 3
  });

  // listener to let UI know that map bounds have changed
  map.addListener('idle', function() {
    boundsLatLng = map.getBounds();
    controlViewModel.updateVisibleQuakes();
  });
}

ko.applyBindings(controlViewModel);
