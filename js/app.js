

var map
function initMap() {
  map = new google.maps.Map(document.getElementById('map_container'), {
    center: {lat: 0, lng: 0},
    zoom: 1
  });
}

// viewmodel for the map controls
function ControlViewModel() {
  var self = this;
  self.earthquakes = ko.observableArray();
  self.feedTypes = ["significant", "4.5", "2.5", "1.0", "all"];
  self.feedTimeHorizons = ["hour", "day", "week", "month"];
  self.curFeedType = ko.observable("significant");
  self.curFeedTimeHorizon = ko.observable("week");


  // Generate a url for the desired earthquake feed
  self.generateFeedUrl = function() {
   let baseFeedUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${self.curFeedType()}_${self.curFeedTimeHorizon()}.geojson`;
   console.log(baseFeedUrl);
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
    console.log(latLng);
    new google.maps.Marker({
      position: {lat: latLng[1], lng: latLng[0]},
      map: map
    });
  });

  // get earthquakes from feed
  self.getQuakeFeed = function() {
    $.getJSON(self.generateFeedUrl(), function(data) {
      self.earthquakes.removeAll();
      for (var i = 0; i < data.features.length; i++) {
       self.earthquakes.push(data.features[i]);
      };
    });
  }

  // update the feed when either select menu changes
  self.curFeedType.subscribe(self.getQuakeFeed, null);
  self.curFeedTimeHorizon.subscribe(self.getQuakeFeed, null);
  // call for inital setup
  self.getQuakeFeed();

}
ko.applyBindings(new ControlViewModel());
