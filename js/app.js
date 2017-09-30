// object to store quake feeds from USGS


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

  // get earthquakes from feed
  self.getQuakeFeed = function() {
    $.getJSON(self.generateFeedUrl(), function(data) {
      self.earthquakes.removeAll();
      for (var i = 0; i < data.features.length; i++) {
       self.earthquakes.push(data.features[i]);
      };
    });
  }
  self.curFeedType.subscribe(self.getQuakeFeed, null);
  self.curFeedTimeHorizon.subscribe(self.getQuakeFeed, null);
  // call for inital setup
  self.getQuakeFeed();

}
ko.applyBindings(new ControlViewModel());
