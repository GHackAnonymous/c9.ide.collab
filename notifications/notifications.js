/*global window apf console*/
define(function(require, exports, module) {
"use strict";

    main.consumes = [
        "CollabPanel", "ui", "api", "info", "dialog.alert", "c9"
    ];
    main.provides = ["notifications"];
    return main;

    function main(options, imports, register) {
        var CollabPanel  = imports.CollabPanel;
        var c9           = imports.c9;
        var ui           = imports.ui;
        var api          = imports.api;
        var alert        = imports["dialog.alert"].show;

        var css          = require("text!./notifications.css");
        var staticPrefix = options.staticPrefix;

        var oop          = require("ace/lib/oop");
        var Tree         = require("ace_tree/tree");
        var TreeData     = require("./notificationsdp");

        var plugin = new CollabPanel("Ajax.org", main.consumes, {
            index   : 150,
            caption : "Notifications",
            height  : "20%"
        });

        // added notification types as classes below
        var NOTIFICATION_TYPES = {};

        // var emit   = plugin.getEmitter();

        var notificationsParent, notificationsTree, notificationsDataProvider;
        var frame, panelButton, bubble;
        // var visible = false;

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;

            // Needed now for bubble
            ui.insertCss(css, staticPrefix, plugin);

            c9.on("ready", loadNotifications);

            if (!options.hosted) {
                // standalone version test
                cachedNotifications = createNotifications([
                    { name: "Bas de Wachter", uid: 8, email: "bas@c9.io", type: "access_request" },
                    { name: "Mostafa Eweda", uid: 1, email: "mostafa@c9.io", type: "access_request" },
                    { name: "Lennart Kats", uid: 5,  email: "lennart@c9.io", type: "access_request" },
                    { name: "Ruben Daniels", uid: 2, email: "ruben@ajax.org", type: "access_request" },
                    { name: "Fabian Jakobs", uid: 4, email: "fabian@ajax.org", type: "access_request" }
                ]);
            }
        }

        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;

            notificationsParent = options.html;

            frame = options.aml;
            
            // Notifications panel
            notificationsTree = new Tree(notificationsParent);
            notificationsDataProvider = new TreeData();
            notificationsTree.renderer.setScrollMargin(0, 10);
            notificationsTree.renderer.setTheme({cssClass: "notificationstree"});
            notificationsTree.setOption("maxLines", 3);
            // Assign the dataprovider
            notificationsTree.setDataProvider(notificationsDataProvider);

            notificationsTree.on("mousedown", function(e){
                var domTarget = e.domEvent.target;

                var pos = e.getDocumentPosition();
                var notif = notificationsDataProvider.findItemAtOffset(pos.y);
                if (!notif || !domTarget)
                    return;

                notif.handleMouseDown(e);
            });
            
            notificationsTree.on("mouseup", function(e){
                var domTarget = e.domEvent.target;

                var pos = e.getDocumentPosition();
                var notif = notificationsDataProvider.findItemAtOffset(pos.y);
                if (!notif || !domTarget)
                    return;

                notif.handleMouseUp(e);
            });
            
            // onNotificationsLoaded();
            // notificationsDataProvider.emptyMessage = "Loading Notifications ...";
            // loadNotifications();
            
            postLoadedNotifications();
        }

        var cachedNotifications = [];
        function loadNotifications() {
            if (!options.isAdmin || !options.hosted)
                return postLoadedNotifications();

            api.collab.get("members/list?pending=1", function (err, members) {
                if (err) return alert(err);

                if (Array.isArray(members)) {
                    members.forEach(function(m) {
                        m.type = "access_request";
                    });
                    cachedNotifications = createNotifications(members);
                    postLoadedNotifications();
                }
            });
        }

        function postLoadedNotifications() {
            if (!bubble) {
                // Notification Bubble
                panelButton = document.querySelector(".panelsbutton.collab");
                bubble = panelButton.appendChild(document.createElement("div"));
                bubble.className = "newnotifs";
            }
            
            if (!cachedNotifications.length) {
                if (drawn) {
                    notificationsDataProvider.emptyMessage = "No pending notifications";
                    frame.setHeight(50);
                }
                bubble.style.display = "none";
            }
            else {
                if (drawn)
                    frame.setHeight(Math.min(cachedNotifications.length, 3) * 50 + 22);
                bubble.innerHTML = cachedNotifications.length;
                bubble.style.display = "block";
                bubble.className = "newnotifs size" + String(cachedNotifications.length).length;
            }
            
            if (!drawn)
                return;
            
            frame.setAttribute("caption", 
                "Notifications (" + cachedNotifications.length + ")");
            
            onNotificationsLoaded();
        }

        function createNotifications(notifs) {
            return notifs.map(function(notif) {
                var NotifConstructor = NOTIFICATION_TYPES[notif.type];
                return new NotifConstructor(notif);
            });
        }

        function onNotificationsLoaded() {
            notificationsDataProvider.setRoot(cachedNotifications);
        }

        /***** Notification Object *****/
        
        function Notification(datarow) {
            this.datarow = datarow;
        }

        (function () {
            this.getHTML = function (datarow) {
                throw new Error("No impl found - getHTML");
            };

            this.handleMouseDown = function () {
                throw new Error("No impl found - handleMouseDown");
            };

            this.remove = function () {
                var _self = this;
                cachedNotifications = cachedNotifications.filter(function (notif) {
                    return notif !== _self;
                });
                postLoadedNotifications();
            };
        }).call(Notification.prototype);

        function AccessRequestNotification(datarow) {
            datarow.md5Email = datarow.email ? apf.crypto.MD5.hex_md5(datarow.email.trim().toLowerCase()) : "";
            this.datarow = datarow;
        }

        oop.inherits(AccessRequestNotification, Notification);

        (function () {
            this.getHTML = function () {
                var datarow = this.datarow;
                var defaultImgUrl = encodeURIComponent("http://www.aiga.org/uploadedImages/AIGA/Content/About_AIGA/Become_a_member/generic_avatar_300.gif");
                var avatarImg = '<img class="gravatar-image" src="https://secure.gravatar.com/avatar/' +
                    datarow.md5Email + '?s=37&d='  + defaultImgUrl + '" />';
                var html = [
                    "<span class='avatar'>", avatarImg, "</span>",
                    "<span class='body'>", "<span class='caption'>", datarow.name, "</span>", 
                    " requests access to this workspace</span>",
                    "<span class='actions access_request'>",
                        '<div class="standalone access_control rw">',
                            '<div class="readbutton">R</div><div class="writebutton">RW</div>',
                        '</div>',
                        '<div class="btn-default-css3 btn-green grant">',
                            '<div class="caption">Grant</div>',
                        '</div>',
                        '<div class="btn-default-css3 btn-red deny">',
                            '<div class="caption">Deny</div>',
                        '</div>',
                    "</span>"
                ];

                return html.join("");
            };

            this.acceptRequest = function (access) {
                var _self = this;
                if (!options.hosted)
                    return requestAccepted();
                    
                var uid = this.datarow.uid;
                api.collab.post("accept_request", {
                    body: {
                        uid    : uid,
                        access : access
                    }
                }, function (err, data, res) {
                    if (err) return alert("Error", err);
                    requestAccepted();
                });
                function requestAccepted() {
                    _self.remove();
                }
            };

            this.denyRequest = function () {
                var _self = this;
                if (!options.hosted)
                    return requestDenied();
                    
                var uid = this.datarow.uid;
                api.collab.post("deny_request", {
                    body: {
                        uid : uid
                    }
                }, function (err, data, res) {
                    if (err) return alert("Error", err);
                    requestDenied();
                });
                function requestDenied() {
                    _self.remove();
                }
            };

            this.handleMouseDown = function (e) {
                var target = e.domEvent.target;
                var className = target.classList;
                if (className.contains("access_control")) {
                    var actionArr = className.contains("rw") ? ["rw", "r"] : ["r", "rw"];
                    className.remove(actionArr[0]);
                    className.add(actionArr[1]);
                    return;
                }
            };
            
            this.handleMouseUp = function (e) {
                var target = e.domEvent.target;
                var className = target.classList;
                if (className.contains("grant")) {
                    var rwClassName = target.previousSibling.classList;
                    var access = rwClassName.contains("rw") ? "rw" : "r";
                    this.acceptRequest(access);
                }
                else if (className.contains("deny")) {
                    this.denyRequest();
                }
            };
        }).call(AccessRequestNotification.prototype);

        NOTIFICATION_TYPES["access_request"] = AccessRequestNotification;
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
            plugin.once("draw", draw);
        });
        plugin.on("enable", function(){

        });
        plugin.on("disable", function(){
        });

        plugin.on("unload", function(){
            loaded = false;
            drawn  = false;
        });

        /***** Register and define API *****/

        /**
         * Adds File->New File and File->New Folder menu items as well as the
         * commands for opening a new file as well as an API.
         * @singleton
         **/
        plugin.freezePublicAPI({
            
        });

        register(null, {
            notifications: plugin
        });
    }

});