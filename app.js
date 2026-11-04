var webAppUrl = "https://script.google.com/macros/s/AKfycby4-tNW7rooq0S7_gMQ2KVB9QwotwGjxiiO2CsJyuqH4tcVa30EQneFjPCjmLjn2r8xRQ/exec";
var personnelSheetUrl = "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit#gid=0";

var base64Image = "", fileName = "", mimeType = "";
var reccePhotos = [];
var personnelPhotoBase64 = "";

var recceMap = null;
var currentPinMode = 'venue';
var venueCoords = null;
var parkingCoords = null;
var venueMarker = null;
var parkingMarker = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateDisplay(dStr) {
  if (!dStr) return '';
  try {
    var d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch(e) {
    return dStr;
  }
}

window.hideAllViews = function() {
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('form-view').style.display = 'none';
  document.getElementById('calendar-view').style.display = 'none';
  document.getElementById('map-view').style.display = 'none';
  document.getElementById('recce-view').style.display = 'none';
  document.getElementById('open-items-view').style.display = 'none';
  document.getElementById('personnel-view').style.display = 'none';
};

window.openForm = function(entryType) {
  window.hideAllViews();
  document.getElementById('form-view').style.display = 'block';
  document.getElementById('type').value = entryType;
  document.getElementById('form-title').innerText = entryType;
};

window.openOpenItems = function() {
  window.hideAllViews();
  document.getElementById('open-items-view').style.display = 'block';
  loadOpenItems();
};

window.openPersonnel = function() {
  window.hideAllViews();
  document.getElementById('personnel-view').style.display = 'block';
};

window.openGoogleSheet = function() {
  window.open(personnelSheetUrl, '_blank');
};

window.openCalendar = function() {
  window.hideAllViews();
  document.getElementById('calendar-view').style.display = 'block';
};

window.openMap = function() {
  window.hideAllViews();
  document.getElementById('map-view').style.display = 'block';
};

window.openRecce = function() {
  window.hideAllViews();
  document.getElementById('recce-view').style.display = 'block';
  setTimeout(function() {
    initRecceMap();
  }, 200);
};

window.goBack = function() {
  window.hideAllViews();
  document.getElementById('dashboard-view').style.display = 'block';
  var s1 = document.getElementById('status-message');
  if (s1) s1.innerText = "";
  var s2 = document.getElementById('recce-status-message');
  if (s2) s2.innerText = "";
  var s3 = document.getElementById('personnel-status-message');
  if (s3) s3.innerText = "";
};

function loadOpenItems() {
  var statusDiv = document.getElementById('open-items-status');
  var listDiv = document.getElementById('open-items-list');
  statusDiv.innerText = "Checking active items...";
  listDiv.innerHTML = "";

  var scriptId = 'jsonp-open-items';
  var oldScript = document.getElementById(scriptId);
  if (oldScript) oldScript.remove();

  window.handleOpenItemsCallback = function(response) {
    if (!response || !response.items || response.items.length === 0) {
      statusDiv.innerText = "✓ All action items are resolved. No open items.";
      return;
    }

    statusDiv.innerText = "Active Action Items (" + response.items.length + "):";
    listDiv.innerHTML = "";

    response.items.forEach(function(item) {
      var card = document.createElement('div');
      card.className = 'task-card';

      var isPending = item.status.toLowerCase() === 'pending';
      var badgeColor = isPending ? '#fb923c' : '#f87171';
      var badgeBg = isPending ? 'rgba(251, 146, 60, 0.15)' : 'rgba(248, 113, 113, 0.15)';

      var evidenceHtml = item.evidence 
        ? '<div style="margin-top: 8px;"><a href="' + item.evidence + '" target="_blank" style="color: #60a5fa; font-weight: 600; font-size: 13px; text-decoration: none;">🔗 View Uploaded Evidence</a></div>'
        : '';

      var updates = [];
      if (Array.isArray(item.updates)) {
        updates = item.updates;
      } else if (typeof item.updates === 'string' && item.updates.trim()) {
        try { updates = JSON.parse(item.updates); } catch(e) {}
      }

      var updatesListHtml = updates.map(function(u) {
        return '<div class="update-bubble">' +
                 '<div class="update-meta">' +
                   '<span>' + escapeHtml(u.author || 'Operator') + '</span>' +
                   '<span>' + formatDateDisplay(u.date) + '</span>' +
                 '</div>' +
                 '<div class="update-content">' + escapeHtml(u.text) + '</div>' +
               '</div>';
      }).join('');

      card.innerHTML = 
        '<div style="display: flex; justify-content: space-between; align-items: center;">' +
          '<span class="task-badge" style="background: ' + badgeBg + '; color: ' + badgeColor + '; border: 1px solid ' + badgeColor + ';">' + item.status + '</span>' +
          '<span style="font-size: 12px; color: var(--text-secondary);">' + (item.date || '') + ' | ' + (item.name || 'Officer') + '</span>' +
        '</div>' +
        '<div style="font-size: 15px; font-weight: 600; margin: 10px 0 6px 0; color: #fff;">' + (item.type || 'Log Entry') + '</div>' +
        '<div style="font-size: 14px; line-height: 1.5; color: #cbd5e1; white-space: pre-wrap; background: var(--card-bg); padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-color);">' + (item.remarks || 'No remarks provided.') + '</div>' +
        evidenceHtml +
        '<div class="updates-section">' +
          '<div class="updates-header">Activity & Follow-ups</div>' +
          '<div class="updates-list" id="updates-list-' + item.rowIndex + '">' +
            updatesListHtml +
          '</div>' +
          '<div class="add-update-container">' +
            '<input type="text" class="update-input-field" id="update-input-' + item.rowIndex + '" placeholder="Type update note...">' +
            '<button type="button" class="btn-add-update" id="btn-update-' + item.rowIndex + '" onclick="addLogUpdate(' + item.rowIndex + ')">Post</button>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="close-item-btn" id="btn-close-' + item.rowIndex + '" onclick="closeLogItem(' + item.rowIndex + ')">✓ Mark as Closed</button>';

      listDiv.appendChild(card);
    });
  };

  var script = document.createElement('script');
  script.id = scriptId;
  script.src = webAppUrl + '?action=getOpenLogs&callback=handleOpenItemsCallback&t=' + Date.now();
  document.body.appendChild(script);
}

window.addLogUpdate = function(rowIndex) {
  var input = document.getElementById('update-input-' + rowIndex);
  var updateText = input ? input.value.trim() : '';
  if (!updateText) return;

  var opNameInput = document.getElementById('active-operator-name');
  var operatorName = (opNameInput && opNameInput.value.trim()) ? opNameInput.value.trim() : 'Operator';
  var currentDateIso = new Date().toISOString();

  var btn = document.getElementById('btn-update-' + rowIndex);
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Posting...";
  }

  var payload = {
    action: "appendLogUpdate",
    rowIndex: rowIndex,
    author: operatorName,
    date: currentDateIso,
    text: updateText
  };

  fetch(webAppUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload)
  }).then(function() {
    var list = document.getElementById('updates-list-' + rowIndex);
    if (list) {
      var bubble = document.createElement('div');
      bubble.className = 'update-bubble';
      bubble.innerHTML = 
        '<div class="update-meta">' +
          '<span>' + escapeHtml(payload.author) + '</span>' +
          '<span>' + formatDateDisplay(payload.date) + '</span>' +
        '</div>' +
        '<div class="update-content">' + escapeHtml(payload.text) + '</div>';
      list.appendChild(bubble);
    }

    if (input) input.value = '';
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Post";
    }
  }).catch(function(err) {
    alert("Failed to post update: " + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Post";
    }
  });
};

window.closeLogItem = function(rowIndex) {
  if (!confirm("Are you sure you want to mark this item as Closed?")) return;

  var btn = document.getElementById('btn-close-' + rowIndex);
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Closing in Sheet...";
    btn.style.backgroundColor = "#475569";
  }

  fetch(webAppUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "closeLogItem",
      rowIndex: rowIndex
    })
  }).then(function() {
    alert("Item closed. Marked green in Google Sheet.");
    loadOpenItems();
  }).catch(function(err) {
    alert("Error closing item: " + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerText = "✓ Mark as Closed";
      btn.style.backgroundColor = "#15803d";
    }
  });
};

window.triggerPersonnelCamera = function() {
  var el = document.getElementById('personnel-camera-input');
  if (el) el.click();
};

window.triggerPersonnelGallery = function() {
  var el = document.getElementById('personnel-gallery-input');
  if (el) el.click();
};

window.removePersonnelPhoto = function() {
  personnelPhotoBase64 = "";
  document.getElementById('personnel-img-tag').style.display = "none";
  document.getElementById('personnel-img-tag').src = "";
  document.getElementById('personnel-placeholder').style.display = "block";
  document.getElementById('btn-remove-photo').style.display = "none";
};

function handlePersonnelImage(file) {
  if (!file) return;
  toBase64(file).then(function(b64) {
    personnelPhotoBase64 = b64;
    var img = document.getElementById('personnel-img-tag');
    img.src = b64;
    img.style.display = "block";
    document.getElementById('personnel-placeholder').style.display = "none";
    document.getElementById('btn-remove-photo').style.display = "block";
  }).catch(function(err) {
    alert("Could not process photo: " + err);
  });
}

window.triggerCamera = function() {
  var el = document.getElementById('recce-camera-input');
  if (el) el.click();
};

window.triggerGallery = function() {
  var el = document.getElementById('recce-gallery-input');
  if (el) el.click();
};

window.setPinMode = function(mode) {
  currentPinMode = mode;
  var btnVenue = document.getElementById('btn-mode-venue');
  var btnParking = document.getElementById('btn-mode-parking');
  var btnGps = document.getElementById('btn-gps-action');

  if (mode === 'venue') {
    btnVenue.style.backgroundColor = '#dc2626';
    btnVenue.style.color = '#fff';
    btnParking.style.backgroundColor = 'var(--panel-bg)';
    btnParking.style.color = 'var(--text-secondary)';
    btnGps.innerText = "🎯 Current GPS to Venue";
  } else {
    btnParking.style.backgroundColor = '#2563eb';
    btnParking.style.color = '#fff';
    btnVenue.style.backgroundColor = 'var(--panel-bg)';
    btnVenue.style.color = 'var(--text-secondary)';
    btnGps.innerText = "🎯 Current GPS to Parking";
  }
};

function initRecceMap() {
  try {
    var container = document.getElementById('recce-map-container');
    if (!container || typeof L === 'undefined') return;

    if (!recceMap) {
      recceMap = L.map('recce-map-container').setView([32.5206, 34.9037], 13);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
      }).addTo(recceMap);

      recceMap.on('click', function(e) {
        handleMapClick(e.latlng.lat, e.latlng.lng);
      });
    }
    recceMap.invalidateSize();
  } catch (err) {
    console.warn("Leaflet map note:", err);
  }
}

function handleMapClick(lat, lng) {
  if (currentPinMode === 'venue') {
    setVenuePin(lat, lng);
  } else {
    setParkingPin(lat, lng);
  }
  updateDisplay();
}

function setVenuePin(lat, lng) {
  venueCoords = { lat: Number(lat).toFixed(6), lng: Number(lng).toFixed(6) };

  if (typeof L !== 'undefined') {
    var redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    if (venueMarker) {
      venueMarker.setLatLng([venueCoords.lat, venueCoords.lng]);
    } else if (recceMap) {
      venueMarker = L.marker([venueCoords.lat, venueCoords.lng], {
        icon: redIcon,
        title: "Venue"
      }).addTo(recceMap).bindPopup("📍 Venue").openPopup();
    }
  }

  document.getElementById('recce-venue-gmaps').value = 'https://www.google.com/maps?q=' + venueCoords.lat + ',' + venueCoords.lng;

  if (!parkingCoords) {
    document.getElementById('recce-waze').value = 'https://waze.com/ul?ll=' + venueCoords.lat + ',' + venueCoords.lng + '&navigate=yes';
  }
}

function setParkingPin(lat, lng) {
  parkingCoords = { lat: Number(lat).toFixed(6), lng: Number(lng).toFixed(6) };

  if (typeof L !== 'undefined') {
    var blueIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    if (parkingMarker) {
      parkingMarker.setLatLng([parkingCoords.lat, parkingCoords.lng]);
    } else if (recceMap) {
      parkingMarker = L.marker([parkingCoords.lat, parkingCoords.lng], {
        icon: blueIcon,
        title: "Parking"
      }).addTo(recceMap).bindPopup("🅿️ Parking").openPopup();
    }
  }

  document.getElementById('recce-parking-gmaps').value = 'https://www.google.com/maps?q=' + parkingCoords.lat + ',' + parkingCoords.lng;
  document.getElementById('recce-waze').value = 'https://waze.com/ul?ll=' + parkingCoords.lat + ',' + parkingCoords.lng + '&navigate=yes';
}

function updateDisplay() {
  var display = document.getElementById('coords-display');
  display.innerHTML = '📍 Venue: ' + (venueCoords ? (venueCoords.lat + ', ' + venueCoords.lng) : 'Not set (Tap map or search)') + '<br>' +
                      '🅿️ Parking: ' + (parkingCoords ? (parkingCoords.lat + ', ' + parkingCoords.lng) : 'Not set (Switch mode, then tap map)');
}

window.clearLocation = function() {
  venueCoords = null;
  parkingCoords = null;

  if (venueMarker && recceMap) { recceMap.removeLayer(venueMarker); venueMarker = null; }
  if (parkingMarker && recceMap) { recceMap.removeLayer(parkingMarker); parkingMarker = null; }

  document.getElementById('coords-display').innerHTML = '📍 Venue: Not set (Tap map or search)<br>🅿️ Parking: Not set (Switch mode, then tap map)';
  document.getElementById('recce-venue-gmaps').value = "";
  document.getElementById('recce-parking-gmaps').value = "";
  document.getElementById('recce-waze').value = "";

  var searchBox = document.getElementById('map-search-input');
  if (searchBox) searchBox.value = "";
  window.setPinMode('venue');
};

window.useCurrentLocation = function() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  var targetName = currentPinMode === 'venue' ? "Venue" : "Parking";
  var coordsDisplay = document.getElementById('coords-display');
  coordsDisplay.innerText = "Getting GPS location for " + targetName + "...";

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      if (recceMap) recceMap.setView([lat, lng], 16);

      if (currentPinMode === 'venue') {
        setVenuePin(lat, lng);
      } else {
        setParkingPin(lat, lng);
      }
      updateDisplay();
    },
    function(err) {
      coordsDisplay.innerHTML = "⚠️ GPS error (" + err.message + "). Tap map directly.";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

window.searchAddress = function() {
  var query = document.getElementById('map-search-input').value.trim();
  if (!query) {
    alert("Please enter a location name or address.");
    return;
  }

  var coordsDisplay = document.getElementById('coords-display');
  coordsDisplay.innerText = 'Searching for "' + query + '"...';

  var endpoint = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&accept-language=en&limit=1';
  fetch(endpoint, { headers: { 'Accept': 'application/json' } })
    .then(function(res) { return res.json(); })
    .then(function(results) {
      if (results && results.length > 0) {
        var lat = parseFloat(results[0].lat);
        var lng = parseFloat(results[0].lon);

        if (recceMap) recceMap.setView([lat, lng], 16);

        if (currentPinMode === 'venue') {
          setVenuePin(lat, lng);
          var locInput = document.getElementById("recce-location");
          if (!locInput.value) {
            locInput.value = results[0].display_name.split(',')[0];
          }
        } else {
          setParkingPin(lat, lng);
        }
        updateDisplay();
      } else {
        alert("Location not found. Try adding a city name or tap the map directly.");
      }
    })
    .catch(function() {
      alert("Search failed. Place pin manually on the map.");
    });
};

function toBase64(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(e) {
      var img = new Image();
      img.src = e.target.result;
      img.onload = function() {
        var maxDim = 1200;
        var width = img.width;
        var height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = function(err) { reject(err); };
    };
    reader.onerror = function(err) { reject(err); };
  });
}

function renderPhotoPreviews() {
  var previewGrid = document.getElementById('photo-preview-grid');
  var countDisplay = document.getElementById('photo-count');
  if (!previewGrid) return;
  previewGrid.innerHTML = "";

  reccePhotos.forEach(function(photo, index) {
    var thumbWrapper = document.createElement('div');
    thumbWrapper.style.position = 'relative';
    thumbWrapper.style.width = '70px';
    thumbWrapper.style.height = '70px';

    var img = document.createElement('img');
    img.src = 'data:' + photo.mimeType + ';base64,' + photo.base64;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    img.style.border = '1px solid var(--border-color)';

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.innerText = '×';
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '-5px';
    removeBtn.style.right = '-5px';
    removeBtn.style.backgroundColor = '#dc2626';
    removeBtn.style.color = 'white';
    removeBtn.style.border = 'none';
    removeBtn.style.borderRadius = '50%';
    removeBtn.style.width = '20px';
    removeBtn.style.height = '20px';
    removeBtn.style.fontSize = '14px';
    removeBtn.style.fontWeight = 'bold';
    removeBtn.lineHeight = '18px';
    removeBtn.style.padding = '0';
    removeBtn.style.cursor = 'pointer';

    removeBtn.onclick = function() {
      reccePhotos.splice(index, 1);
      renderPhotoPreviews();
      if (countDisplay) countDisplay.innerText = reccePhotos.length + " photo(s) attached";
    };

    thumbWrapper.appendChild(img);
    thumbWrapper.appendChild(removeBtn);
    previewGrid.appendChild(thumbWrapper);
  });
}

function handleIncomingFiles(fileList) {
  var files = Array.from(fileList);
  var countDisplay = document.getElementById('photo-count');

  files.forEach(function(f) {
    if (reccePhotos.length >= 10) {
      alert("Maximum of 10 photos reached.");
      return;
    }

    if (countDisplay) countDisplay.innerText = "Processing photo... (" + (reccePhotos.length + 1) + "/10)";

    toBase64(f).then(function(b64WithHeader) {
      var rawB64 = b64WithHeader.split(',')[1];
      reccePhotos.push({
        base64: rawB64,
        mimeType: "image/jpeg",
        name: f.name || ('photo_' + Date.now() + '.jpg')
      });
      renderPhotoPreviews();
      if (countDisplay) countDisplay.innerText = reccePhotos.length + " photo(s) attached";
    }).catch(function(err) {
      console.error("Compression failed:", err);
    });
  });
}

window.onload = function() {
  var d1 = document.getElementById('date');
  if (d1) d1.valueAsDate = new Date();
  var d2 = document.getElementById('recce-date');
  if (d2) d2.valueAsDate = new Date();
  var d3 = document.getElementById('p-startdate');
  if (d3) d3.valueAsDate = new Date();

  var singlePhoto = document.getElementById('photo-upload');
  if (singlePhoto) {
    singlePhoto.onchange = function(e) {
      var file = e.target.files[0];
      if (file) {
        fileName = file.name;
        mimeType = file.type;
        var reader = new FileReader();
        reader.onload = function(ev) { base64Image = ev.target.result.split(',')[1]; };
        reader.readAsDataURL(file);
      }
    };
  }

  var pCamera = document.getElementById('personnel-camera-input');
  if (pCamera) {
    pCamera.onchange = function(e) {
      if (e.target.files.length > 0) {
        handlePersonnelImage(e.target.files[0]);
        pCamera.value = "";
      }
    };
  }

  var pGallery = document.getElementById('personnel-gallery-input');
  if (pGallery) {
    pGallery.onchange = function(e) {
      if (e.target.files.length > 0) {
        handlePersonnelImage(e.target.files[0]);
        pGallery.value = "";
      }
    };
  }

  var cameraInput = document.getElementById('recce-camera-input');
  if (cameraInput) {
    cameraInput.onchange = function(e) {
      if (e.target.files.length > 0) {
        handleIncomingFiles(e.target.files);
        cameraInput.value = "";
      }
    };
  }

  var galleryInput = document.getElementById('recce-gallery-input');
  if (galleryInput) {
    galleryInput.onchange = function(e) {
      if (e.target.files.length > 0) {
        handleIncomingFiles(e.target.files);
        galleryInput.value = "";
      }
    };
  }

  var searchField = document.getElementById('map-search-input');
  if (searchField) {
    searchField.onkeydown = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.searchAddress();
      }
    };
  }

  var pForm = document.getElementById("personnelForm");
  if (pForm) {
    pForm.onsubmit = function(e) {
      e.preventDefault();
      var confirmBox = document.getElementById("personnel-confirm-checkbox");
      if (!confirmBox.checked) {
        alert("Please check the confirmation box.");
        return;
      }

      var btn = document.getElementById("personnelSubmitBtn");
      btn.disabled = true;
      btn.innerText = "Transmitting to Roster...";
      btn.style.backgroundColor = "#475569";

      var payload = {
        action: "addPersonnel",
        photoBase64: personnelPhotoBase64,
        name: document.getElementById("p-name").value.trim(),
        jobTitle: document.getElementById("p-position").value.trim(),
        startDate: document.getElementById("p-startdate").value,
        phone: document.getElementById("p-phone").value.trim(),
        emergency: document.getElementById("p-emergency").value.trim(),
        allergies: document.getElementById("p-allergies").value.trim()
      };

      fetch(webAppUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      }).then(function() {
        alert("Personnel entry saved successfully.");
        btn.disabled = false;
        btn.innerText = "Save to Personnel Sheet";
        btn.style.backgroundColor = "#0d9488";
        pForm.reset();
        window.removePersonnelPhoto();
        var dReset = document.getElementById('p-startdate');
        if (dReset) dReset.valueAsDate = new Date();
        window.goBack();
      }).catch(function(err) {
        alert("Upload failed: " + err.message);
        btn.disabled = false;
        btn.innerText = "Save to Personnel Sheet";
        btn.style.backgroundColor = "#0d9488";
        document.getElementById('personnel-status-message').innerText = "Upload error: " + err;
        document.getElementById('personnel-status-message').className = "error";
      });
    };
  }

  var recceForm = document.getElementById("recceForm");
  if (recceForm) {
    recceForm.onsubmit = function(e) {
      e.preventDefault();
      var locationName = document.getElementById("recce-location").value.trim();
      var officer = document.getElementById("recce-officer").value.trim();
      var desc = document.getElementById("recce-desc").value.trim();
      var venueGmapsVal = document.getElementById("recce-venue-gmaps").value.trim();
      var confirmBox = document.getElementById("recce-confirm-checkbox");

      if (!confirmBox.checked) {
        alert("Please confirm the review checkbox before submitting.");
        return;
      }

      if (!venueCoords && !venueGmapsVal) {
        alert("Please set a venue location on the map before submitting.");
        return;
      }

      var confirmed = confirm(
        "SUBMIT RECCE REPORT?\n\n" +
        "• Venue: " + locationName + "\n" +
        "• Officer: " + officer + "\n" +
        "• Photos: " + reccePhotos.length + "\n\n" +
        "Generate PDF and save to Google Drive?"
      );

      if (!confirmed) return;

      var btn = document.getElementById("recceSubmitBtn");
      btn.disabled = true;
      btn.innerText = "Generating PDF & Uploading...";
      btn.style.backgroundColor = "#475569";

      var payload = {
        formType: "Recce",
        locationName: locationName,
        officer: officer,
        date: document.getElementById("recce-date").value,
        description: desc,
        googleMapsUrl: venueGmapsVal,
        parkingGoogleMapsUrl: document.getElementById("recce-parking-gmaps").value.trim(),
        wazeUrl: document.getElementById("recce-waze").value.trim(),
        lat: venueCoords ? venueCoords.lat : "0",
        lng: venueCoords ? venueCoords.lng : "0",
        parkingLat: parkingCoords ? parkingCoords.lat : "",
        parkingLng: parkingCoords ? parkingCoords.lng : "",
        photos: reccePhotos
      };

      fetch(webAppUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      }).then(function() {
        alert("Report submitted successfully.");
        btn.disabled = false;
        btn.innerText = "Generate & Submit Recce PDF";
        btn.style.backgroundColor = "#7c3aed";
        document.getElementById("recceForm").reset();
        window.clearLocation();
        reccePhotos = [];
        var previewGrid = document.getElementById("photo-preview-grid");
        if (previewGrid) previewGrid.innerHTML = "";
        var countDisplay = document.getElementById("photo-count");
        if (countDisplay) countDisplay.innerText = "0 photos attached";
        var dRecce = document.getElementById('recce-date');
        if (dRecce) dRecce.valueAsDate = new Date();
        window.goBack();
      }).catch(function(err) {
        alert("Network error: " + err.message);
        btn.disabled = false;
        btn.innerText = "Generate & Submit Recce PDF";
        btn.style.backgroundColor = "#7c3aed";
        document.getElementById('recce-status-message').innerText = "Upload error: " + err;
        document.getElementById('recce-status-message').className = "error";
      });
    };
  }

  var logForm = document.getElementById("logForm");
  if (logForm) {
    logForm.onsubmit = function(event) {
      event.preventDefault();
      var logConfirm = document.getElementById("log-confirm-checkbox");
      if (!logConfirm.checked) {
        alert("Please confirm the entry before submitting.");
        return;
      }

      var confirmed = confirm("Submit this log entry?");
      if (!confirmed) return;

      var btn = document.getElementById("submitBtn");
      btn.disabled = true;
      btn.innerText = "Uploading...";
      btn.style.backgroundColor = "#475569";

      var payload = {
        formType: "Log",
        column2: document.getElementById("name").value,
        column3: document.getElementById("date").value,
        column4: document.getElementById("type").value,
        column5: document.getElementById("remarks").value,
        column6: document.getElementById("status").value,
        column7: document.getElementById("evidence").value,
        imageBase64: base64Image,
        fileName: fileName,
        mimeType: mimeType
      };

      fetch(webAppUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      }).then(function() {
        alert("Log entry submitted.");
        btn.disabled = false;
        btn.innerText = "Submit Log Entry";
        btn.style.backgroundColor = "#2563eb";
        document.getElementById("logForm").reset();
        var dLog = document.getElementById('date');
        if (dLog) dLog.valueAsDate = new Date();
        base64Image = ""; fileName = ""; mimeType = "";
        window.goBack();
      }).catch(function(err) {
        alert("Log error: " + err.message);
        btn.disabled = false;
        btn.innerText = "Submit Log Entry";
        btn.style.backgroundColor = "#2563eb";
        document.getElementById('status-message').innerText = "Error sending data.";
        document.getElementById('status-message').className = "error";
      });
    };
  }
};
