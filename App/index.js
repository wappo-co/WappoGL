if (typeof ejecta !== 'undefined') {
  ejecta.include('lodash.min.js');
  ejecta.include('three.js');
}

var FONT_SIZE = 32;
// The square letter texture will have 16 * 16 = 256 letters, enough for all 8-bit characters.
var CHARS_PER_SIDE = 16;
// This is a magic number for aligning the letters on rows. YMMV.
var Y_OFFSET = -0.25;
var MAX_MESSAGE_COLS = 29;

window.ChateauMessage = function(params) {
  this.defaults = {
    message: '',
    geometry_data: {},
    face_offset: 0
  }

  _.merge(this, this.defaults, params);


  this.set_message = function(message) {
    this.message = message;
    this.generate_geometry_data();
  }

  this.generate_geometry_data = function() {
    var chr = 0;
    var code = 0;
    var chr_x = 0;
    var chr_y = 0;
    var row = 0;
    var col = 0;

    var faces = [];
    var faceVertexUvs = [];
    var vertices = [];

    for (chr = 0; chr < this.message.length; chr++) {
      code = this.message.charCodeAt(chr);

      if (code === 10 || col === MAX_MESSAGE_COLS) {
        row--;
        col = 0;
      }

      chr_x = code % CHARS_PER_SIDE;
      chr_y = Math.floor(code / CHARS_PER_SIDE);

      vertices.push(
        new THREE.Vector3(col * 1.1 + 0.05, (row * 1.8) - 0.45, 0),
        new THREE.Vector3(col * 1.1 + 1.05, (row * 1.8) - 0.45, 0),
        new THREE.Vector3(col * 1.1 + 1.05, (row * 1.8) + 1.25, 0),
        new THREE.Vector3(col * 1.1 + 0.05, (row * 1.8) + 1.25, 0)
      );

      var fchr = chr + this.face_offset;

      var face = new THREE.Face3(fchr * 4 + 0, fchr * 4 + 1, fchr * 4 + 2);
      faces.push(face);

      face = new THREE.Face3(fchr * 4 + 0, fchr * 4 + 2, fchr * 4 + 3);
      faces.push(face);

      var ox = (chr_x + 0.00) / CHARS_PER_SIDE;
      var oy = (chr_y + 0.05) / CHARS_PER_SIDE;
      var offx = 0.6 / CHARS_PER_SIDE;
      var offy = 0.9 / CHARS_PER_SIDE;
      var sz = CHARS_PER_SIDE * FONT_SIZE;

      faceVertexUvs.push([
        new THREE.Vector2(ox, oy + offy),
        new THREE.Vector2(ox + offx, oy + offy),
        new THREE.Vector2(ox + offx, oy)
      ]);

      faceVertexUvs.push([
        new THREE.Vector2(ox, (oy + offy)),
        new THREE.Vector2((ox + offx), oy),
        new THREE.Vector2(ox, oy)
      ]);

      if (code !== 10) col++;
    }

    this.geometry_data = {
      faces: faces,
      faceVertexUvs: faceVertexUvs,
      vertices: vertices
    };
  }

  this.generate_geometry_data();
}

window.ChateauGL = function(params) {
  this.defaults = {
    width: 375,
    height: 667,
    renderer: new THREE.WebGLRenderer({
      canvas: document.getElementById('canvas'),
      antialias: true
    }),
    fov: 30,
    near: 1,
    far: 1000,
    chat_messages: [],
    face_offset: 0
  }

  _.merge(this, this.defaults, params);

  this.domElement = this.renderer.domElement;

  this.camera = new THREE.PerspectiveCamera(this.fov, this.width / this.height, this.near, this.far);

  this.scene = new THREE.Scene();
  this.scene.add(this.camera);

  //this.text_texture = drawFontTexture();
  THREE.ImageUtils.crossOrigin = '';
  this.text_texture = THREE.ImageUtils.loadTexture('font.png');
  // Tell Three.js not to flip the texture.
  this.text_texture.flipY = false;
  // And tell Three.js that it needs to update the texture.
  this.text_texture.minFilter = THREE.LinearFilter;
  this.text_material = new THREE.MeshBasicMaterial({
    map: this.text_texture,
    transparent: true,
    //wireframe: true,
    //color: 'blue'
  });

  this.text_geometry = new THREE.Geometry();

  this.text_mesh = new THREE.Mesh(
    this.text_geometry,
    this.text_material
  );
  this.text_mesh.doubleSided = true;

  this.text_threeobj = new THREE.Object3D();
  this.text_threeobj.add(this.text_mesh);

  this.scene.add(this.text_threeobj);

  var self = this;

  this.render = function() {
    this.text_mesh.geometry.dispose();

    self.renderer.render(self.scene, self.camera);
  };

  this.resize_callback = function() {
    self.renderer.setSize(self.width, self.height);
    self.camera.updateProjectionMatrix();
  };

  this.add_chat_message = function(message, right_side) {
    if (_.isUndefined(right_side)) right_side = false;

    var new_chat_message = new ChateauMessage({
      message: message,
      face_offset: this.face_offset
    });

    this.chat_messages.push(new_chat_message);

    this.render_chat_message(_.last(this.chat_messages), right_side);

    this.face_offset += (message.length);
  };

  this.render_chat_message = function(chat_message, right_side) {
    if (_.isUndefined(right_side)) right_side = false;

    this.apply_offsets(chat_message, right_side);

    var self = this;
    var geometry_data = chat_message.geometry_data;

    _.forEach(geometry_data.vertices, function(vertex) {
      self.text_geometry.vertices.push(vertex);
    });

    _.forEach(geometry_data.faces, function(face) {
      self.text_geometry.faces.push(face);
    });

    _.forEach(geometry_data.faceVertexUvs, function(fvu) {
      self.text_geometry.faceVertexUvs[0].push(fvu);
    });

    this.render();
  };

  this.apply_offsets = function(chat_message, right_side) {
    if (_.isUndefined(right_side)) right_side = false;

    var max_x = _.pluck(_.sortBy(chat_message.geometry_data.vertices, function(v) {
      return -v.x;
    }), 'x')[0];
    var offset_x = (right_side) ? 38.35 - max_x : 0;

    var min_y = getCompoundBoundingBox(this.text_threeobj).min.y;
    var offset_y = (-min_y > 0) ? min_y - 2 : 0;

    _.map(chat_message.geometry_data.vertices, function(v) {
      v.setX(v.x + offset_x);
      v.y += offset_y;
      return v;
    });
  };
}

function initChateauGL() {
  window.chateau_gl = new ChateauGL();

  window.chateau_gl.renderer.setClearColor(0xffffff);
  //document.body.appendChild(window.chateau_gl.domElement);

  window.chateau_gl.camera.position.z = 128;
  window.chateau_gl.camera.position.x = 19.25;
  window.chateau_gl.camera.position.y = -33;

  window.chateau_gl.resize_callback();
  window.chateau_gl.render();

}

function drawFontTexture() {
  var canvas_el = document.createElement('canvas');
  //document.body.appendChild(canvas_el);

  canvas_el.width = canvas_el.height = FONT_SIZE * CHARS_PER_SIDE;
  var canvas_ctx = canvas_el.getContext('2d');
  canvas_ctx.font = FONT_SIZE + 'px Monospace';


  // Draw all the letters to the canvas.
  for (var i = 0, y = 0; y < CHARS_PER_SIDE; y++) {
    for (var x = 0; x < CHARS_PER_SIDE; x++, i++) {
      var ch = String.fromCharCode(i);
      canvas_ctx.fillText(ch, x * FONT_SIZE, Y_OFFSET * FONT_SIZE + (y + 1) * FONT_SIZE);
    }
  }

  // Create a texture from the letter canvas.
  var texture = new THREE.Texture(canvas_el);
  // Tell Three.js not to flip the texture.
  texture.flipY = false;
  // And tell Three.js that it needs to update the texture.
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;

  return texture;
}

function getCompoundBoundingBox(object3D) {
  var box = null;
  object3D.traverse(function(obj3D) {
    var geometry = obj3D.geometry;
    if (geometry === undefined) return;
    geometry.computeBoundingBox();
    if (box === null) {
      box = geometry.boundingBox;
    } else {
      box.union(geometry.boundingBox);
    }
  });
  return box;
}

initChateauGL();

var animate = function(t) {      
  chateau_gl.render();
  requestAnimationFrame(animate, chateau_gl.domElement);
};
animate(Date.now());

chateau_gl.add_chat_message("fasdasd\nsdgfdsf");
chateau_gl.add_chat_message("aasdd");
chateau_gl.add_chat_message("aasdd", true);
chateau_gl.add_chat_message("aasdd");