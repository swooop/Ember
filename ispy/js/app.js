App = Ember.Application.create();

App.SIMPERIUM_APP_ID = 'fall-diamonds-154';
App.SIMPERIUM_TOKEN = '1ea38ab3d02748ffaea667419e4dd292';

// Initializers

App.initializer({
  name: 'simperium',
  initialize: function() {
    App.simperium = new Simperium(App.SIMPERIUM_APP_ID, {
      token : App.SIMPERIUM_TOKEN
    });
  }
});

App.initializer({
  name: 'stores',
  initialize: function() {
    App.Objective.store = App.ObjectiveStore.create();
    App.User.store = App.UserStore.create();
  }
});


// Routes

App.Router.map(function() {
  this.resource('objectives', function() {
    this.route('new');
  });
  this.resource('objective', { path: 'objectives/:objective_id' } );
  this.resource('users');
});

App.IndexRoute = Ember.Route.extend({
  redirect: function() {
    this.transitionTo('objectives');
  }
});

App.ObjectivesRoute = Ember.Route.extend({
  model: function() {
    return App.Objective.find();
  }
});

App.ObjectivesNewRoute = Ember.Route.extend({
  model: function() {
    return App.Objective.createRecord({});
  }
});

App.UsersRoute = Ember.Route.extend({
  model: function() {
    return App.User.find();
  }
});


// Models

App.Model = Ember.Object.extend({
  fields: [],

  forWire: function() {
    return this.getProperties(this.get('fields'));
  },

  commit: function() {
    this.get('store').commit(this.get('id'));
  }
});

App.User = App.Model.extend({
  fields: ['id', 'name']
});

App.User.find = function(id) {
  if (Ember.isNone(id)) {
    return App.User.store.all();
  } else {
    return App.User.store.find(id);
  }
}

App.User.createRecord = function(properties) {
  return App.User.store.createRecord(properties);
}

App.Objective = App.Model.extend({
  fields: ['id', 'name', 'createdAt', 'description', 'location', 'coordinates', 'address'],

  addressDidChange: _.debounce(function() {
    if (Ember.isEmpty(this.get('address'))) return;

    var geocoder = new google.maps.Geocoder(),
        self = this;

    geocoder.geocode(this.getProperties('address'), function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        var location = results[0].geometry.location;
        self.set('location', location);
        self.set('coordinates', [location.lat(), location.lng()]);
        self.set('address', results[0].formatted_address);
      } else {
        alert('Geocode was not successful for the following reason: ' + status);
      }
    });
  }, 1500).observes('address')
});

App.Objective.find = function(id) {
  if (Ember.isNone(id)) {
    return App.Objective.store.all();
  } else {
    return App.Objective.store.find(id);
  }
}

App.Objective.createRecord = function(properties) {
  return App.Objective.store.createRecord(properties);
}

// Stores

App.Store = Ember.Object.extend({
  init: function() {
    this._super();
    this.set('idMap', {});
    this.set('hydratedObjects', []);
    this._createBucket();
  },

  all: function() {
    return this.get('hydratedObjects');
  },

  find: function(id) {
    return this._objectFor(id);
  },

  commit: function(id) {
    var object = this.find(id);
    if (!this.get('hydratedObjects').contains(object)) {
      this.get('hydratedObjects').addObject(object);
    }
    this.get('bucket').update(id);
  },

  createRecord: function(properties) {
    var id = moment().valueOf().toString();
    properties.id = id;
    var object = this.find(id);
    object.setProperties(properties);
    return object;
  },

  _createBucket: function() {
    var bucket = App.simperium.bucket(this.get('name')),
        self = this;

    bucket.on('notify', function(id, properties) {
      self._hydrateObject(id, properties);
    });

    bucket.on('local', function(id) {
      var object = self.find(id);
      return object.forWire();
    });

    bucket.start();

    this.set('bucket', bucket);
  },

  _objectFor: function(id) {
    var idMap = this.get('idMap');

    return idMap[id] = idMap[id] ||
                       this.get('model').create({ id: id, store: this });
  },

  _hydrateObject: function(id, properties) {
    var object = this._objectFor(id);
    object.setProperties(this.deserialize(properties));
    this.get('hydratedObjects').addObject(object);
  },

  deserialize: function(object, properties) {
    return {};
  }
});

App.UserStore = App.Store.extend({
  name: 'users',
  model: App.User,
  deserialize: function(properties) {
    return {
      id: properties.id,
      name: properties.name
    }
  }
});

App.ObjectiveStore = App.Store.extend({
  name: 'objectives',
  model: App.Objective,
  deserialize: function(properties) {
    return {
      name: properties.name,
      createdAt: Date.parse(properties.createdAt),
      description: properties.description,
      address: properties.address,
      location: properties.location,
      coordinates: properties.coordinates
    }
  }
});

// Controllers

App.ObjectivesNewController = Ember.ObjectController.extend({
  save: function() {
    this.get('model').commit();
    this.transitionToRoute('objective', this.get('model'));
  }
});


// Views & Helpers

App.MapView = Ember.View.extend({
  didInsertElement: function() {
    var coordinates = this.get( 'coordinates' );
    var location = this.get( 'location' );
    var latlng = new google.maps.LatLng( coordinates[0], coordinates[1] );
    var mapOptions = {
      zoom: 15,
      center: latlng,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    }
    var element = this.get('element');
    var container = $('<div>', { class: 'map-canvas' });
    container.appendTo(element);
    var map = new google.maps.Map( container[0], mapOptions );
    var marker = new google.maps.Marker({
        map: map,
        position: latlng
    });
    map.setCenter(latlng);
  }
});

Ember.Handlebars.registerBoundHelper('humanDate', function(date) {
  if (!Ember.isNone(date)) return moment(date).fromNow();
});

Ember.Handlebars.registerBoundHelper('latLng', function(coordinates) {
  if (!Ember.isNone(coordinates)) return coordinates.join(',');
});