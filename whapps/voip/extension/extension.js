winkstart.module('voip', 'extension', {
        css: [
            'css/extension.css'
        ],

        templates: {
            create: 'tmpl/create.html',
            extension: 'tmpl/extension.html',
            popup_saved: 'tmpl/popup_saved.html'
        },

        subscribe: {
            'extension.activate': 'activate'
        },

        validation : [
            { name: '#email',                     regex: _t('extension', 'email_regex') },
            { name: '#name_first',                regex: _t('extension', 'name_regex') },
            { name: '#name_last',                 regex: _t('extension', 'name_regex') },
            { name: '#password',                  regex: _t('extension', 'numeric_regex') },
            { name: '#username',                  regex: _t('extension', 'numeric_regex') },
        ],

        resources: {
            'extension.create_callflow': {
                url: '{api_url}/accounts/{account_id}/callflows',
                contentType: 'application/json',
                verb: 'PUT'
            },
            'extension.create_device': {
                url: '{api_url}/accounts/{account_id}/devices',
                contentType: 'application/json',
                verb: 'PUT'
            },
            'extension.create_user': {
                url: '{api_url}/accounts/{account_id}/users',
                contentType: 'application/json',
                verb: 'PUT'
            },
            'extension.create_vmbox': {
                url: '{api_url}/accounts/{account_id}/vmboxes',
                contentType: 'application/json',
                verb: 'PUT'
            },
            'extension.delete_device': {
                url: '{api_url}/accounts/{account_id}/devices/{device_id}',
                contentType: 'application/json',
                verb: 'DELETE'
            },
            'extension.delete_user': {
                url: '{api_url}/accounts/{account_id}/users/{user_id}',
                contentType: 'application/json',
                verb: 'DELETE'
            },
            'extension.delete_vmbox': {
                url: '{api_url}/accounts/{account_id}/vmboxes/{vmbox_id}',
                contentType: 'application/json',
                verb: 'DELETE'
            },
            'extension.get_account': {
                url: '{api_url}/accounts/{account_id}',
                contentType: 'application/json',
                verb: 'GET'
            },
            'extension.list_callflows': {
                url: '{api_url}/accounts/{account_id}/callflows',
                contentType: 'application/json',
                verb: 'GET'
            },
            'extension.list_phone_numbers': {
                url: '{api_url}/accounts/{account_id}/phone_numbers',
                contentType: 'application/json',
                verb: 'GET'
            }
        }
    },

    function(args) {
        var THIS = this;

        winkstart.registerResources(THIS.__whapp, THIS.config.resources);

        winkstart.publish('whappnav.subnav.add', {
            whapp: 'voip',
            module: THIS.__module,
            label: _t('extension', 'extensions_label'),
            icon: 'user',
            weight: '10'
        });
    },

    {
        /**
         * Called when the module is activated (usually) via the voip dropdown
         * menu.
         *
         * @param {Object} args - May contain "callback" func to be called when
         * the module has finished activating
         */
        activate: function(args) {
            var THIS = this,
                args = args || {},
                extension_html = THIS.templates.extension.tmpl(),
                parent = args.parent || $('#ws-content');

            (parent)
                .empty()
                .append(extension_html);
            
            THIS.load_extension_create({
                    account_id: winkstart.apps['voip'].account_id
                },
                {
                    after_render: args.callback || {}
                }
            );
        },

        /**
         * Load data required to initially populate the form.
         *
         * @param {Object} data - Contains "account_id" that should be used for
         * the requests
         * @param {Object} _callbacks - May contain callbacks to execute
         * after 1. "save_success" and 2. form render ("after_render"). Both
         * accept 2 args: data, success
         */
        load_extension_create: function(data, _callbacks) {
            var THIS = this,
                _callbacks = _callbacks || {},
                callbacks = {
                    after_render: _callbacks.after_render,
                    save_success: _callbacks.save_success || function(callflow_data) {
                        THIS.render_save_success_popup(callflow_data);
                    }
                };

            winkstart.parallel({
                    account: function(callback) {
                        winkstart.request('extension.get_account', {
                                account_id: data.account_id,
                                api_url: winkstart.apps['voip'].api_url
                            },
                            function(_data, status) {
                                callback(null, _data);
                            },
                            function(_data, status) {
                                callback(status, null);
                            }
                        );
                    },
                    callflows: function(callback) {
                        winkstart.request('extension.list_callflows', {
                                account_id: data.account_id,
                                api_url: winkstart.apps['voip'].api_url
                            },
                            function(_data, status) {
                                callback(null, _data);
                            },
                            function(_data, status) {
                                callback(status, null);
                            }
                        );
                    },
                    phone_numbers: function(callback) {
                        winkstart.request('extension.list_phone_numbers', {
                                account_id: data.account_id,
                                api_url: winkstart.apps['voip'].api_url
                            },
                            function(_data, status) {
                                callback(null, _data);
                            },
                            function(_data, status) {
                                callback(status, null);
                            }
                        );
                    }
                },
                function(err, results) {
                    // Filter out phone number that are already in use on a callflow
                    $.each(results.callflows.data, function(key, callflow) {
                        if('numbers' in callflow && $.isArray(callflow.numbers)) {
                            $.each(callflow.numbers, function(key, number) {
                                delete results.phone_numbers.data.numbers[number];
                            });
                        }
                    });

                    // Convert the phone_numbers data to an array
                    var phone_numbers = [];
                    $.each(results.phone_numbers.data.numbers, function(key, value) {
                        phone_numbers.push(key);
                    });
                    results.phone_numbers = phone_numbers;

                    THIS.render_extension_create(results, callbacks);
                }
            );
        },

        /**
         * Render template data for the form.
         *
         * @param {Object} data - Data fetched from the API for populating
         * initial form state.
         * @param {Object} callbacks
         * @see load_extension_create
         */
        render_extension_create: function(data, callbacks) {
            data._t = function(param){
                return window.translate['extension'][param];
            }
            var THIS = this,
                create_html = THIS.templates.create.tmpl(data),
                parent = $('#extension-content'),
                target = $('#extension-view', parent);
                
            winkstart.validate.set(THIS.config.validation, create_html);
            
            winkstart.timezone.populate_dropdown($('#timezone', create_html), data.account.timezone);

            $('#phone_number', create_html).change(function(ev) {
                $('#use_phone_number_as_outbound_cid_input > input').prop('disabled', this.value == '');
                $('#use_phone_number_as_outbound_cid_input > span').toggleClass('disabled', this.value == '');
            });

            $('.extension-save', create_html).click(function(ev) {
                ev.preventDefault();

                winkstart.validate.is_valid(THIS.config.validation, create_html, function() {
                        var form_data = form2object('extension-form');

                        THIS.load_save_prereqs(form_data, callbacks);
                    },
                    function() {
                        winkstart.alert(_t('extension', 'there_were_errors_on_the_form'));
                    }
                );
            });

            (target)
                .empty()
                .append(create_html);

            if(typeof callbacks.after_render == 'function') {
                callbacks.after_render();
            }
        },

        /**
         * Display popup confirming success of extension creation. Offers two
         * options - "Create Another Extension" and "Go to Callflow x".
         *
         * @param {Object} callflow_data - Data returned from the save_callflow
         * operation.
         */
        render_save_success_popup: function(callflow_data) {
            var THIS = this,
                data = {
                    _t: function(param) {
                        return window.translate['extension'][param];
                    },
                    callflow_data: callflow_data
                },
                popup_html = THIS.templates.popup_saved.tmpl(data),
                dialog = winkstart.dialog(popup_html, {
                    title: window.translate['extension']['extensions_label']
                });

            $('#create_another_extension', popup_html).click(function(ev) {
                // Refresh the extension create screen
                winkstart.publish('extension.activate');
                dialog.dialog('close');
            });

            $('#go_to_callflow', popup_html).click(function(ev) {
                // Load the callflow module, then edit the callflow that was created
                winkstart.publish('callflow.activate', {
                    callback: function() {
                        winkstart.publish('callflow.edit-callflow', callflow_data);
                    }
                });
                dialog.dialog('close');
            });
        },

        /**
         * Loads data that augments form data to be saved.
         *
         * @param {Object} form_data - Form data to be saved
         * @param {Object} callbacks
         * @see load_extension_create
         */
        load_save_prereqs: function(form_data, callbacks) {
            var THIS = this;

            winkstart.request('extension.get_account', {
                    account_id: winkstart.apps['voip'].account_id,
                    api_url: winkstart.apps['voip'].api_url
                },
                function(_data, status) {
                    THIS.save_user(_data.data, form_data, callbacks.save_success,
                        THIS.format_error(winkstart.error_message.process_error()));
                },
                winkstart.error_message.process_error()
            );
        },

        /**
         * Save a new user.
         *
         * @param {Object} account_data - Data from the working account to be
         * added to the user.
         * @param {Object} form_data
         * @see load_save_prereqs
         * @param {function} success - Function to call on success
         * @param {function} error - Function to call on error
         */
        save_user: function(account_data, form_data, success, error) {
            var THIS = this,
                user_data = {
                    call_forward: {
                        keep_caller_id: true,
                        substitute: false
                    },
                    email: form_data.email,
                    fax_to_email_enabled: true,
                    first_name: form_data.name_first,
                    last_name: form_data.name_last,
                    password: form_data.password,
                    timezone: form_data.timezone,
                    username: form_data.username
                };

            // Default apps
            if($.inArray('userportal', account_data.available_apps || []) > -1) {
                user_data.apps = {
                    userportal: {
                        label: window.translate['user']['user_portal_label'],
                        icon: 'userportal',
                        api_url: winkstart.apps['voip'].api_url
                    }
                };
            }

            // Use phone number as outbound CID?
            if(form_data.use_phone_number_as_outbound_cid &&
                    !$('#use_phone_number_as_outbound_cid').prop('disabled')) {
                user_data.caller_id = {
                    external: {
                        number: form_data.phone_number
                    }
                };
            }

            winkstart.request(true, 'extension.create_user', {
                    account_id: winkstart.apps['voip'].account_id,
                    api_url: winkstart.apps['voip'].api_url,
                    data: user_data
                },
                function(_data, status) {
                    THIS.save_device(form_data, _data.data, success,
                        function(error_data, status) {
                            // Rollback
                            winkstart.request('extension.delete_user', {
                                account_id: winkstart.apps['voip'].account_id,
                                api_url: winkstart.apps['voip'].api_url,
                                user_id: _data.data.id
                            });
                            console.log('rolled back creation of user ' + _data.data.id);
                            error(error_data, status);
                        }
                    );
                },
                function(_data, status) {
                    if(typeof error == 'function') {
                        error(_data, status);
                    }
                }
            );
        },

        /**
         * Save a new device.
         *
         * @param {Object} form_data
         * @see load_save_prereqs
         * @param {Object} user_data - Data returned as a result of successful
         * user save.
         * @param {function} success - Function to call on success
         * @param {function} error - Function to call on error
         */
        save_device: function(form_data, user_data, success, error) {
            var THIS = this,
                device_data = {
                    call_forward: {
                        require_keypress: false,
                        substitute: false
                    },
                    device_type: 'sip_device',
                    media: {
                        audio: {
                            codecs: [
                                'G722',
                                'G729',
                                'PCMU'
                            ]
                        },
                        bypass_media: 'auto',
                        fax: {
                            option: 'auto'
                        }
                    },
                    name: form_data.username,
                    owner_id: user_data.id,
                    sip: {
                        invite_format: 'username',
                        password: winkstart.random_string(12),
                        username: form_data.username
                    }
                };

            winkstart.request(true, 'extension.create_device', {
                    account_id: winkstart.apps['voip'].account_id,
                    api_url: winkstart.apps['voip'].api_url,
                    data: device_data
                },
                function(_data, status) {
                    THIS.save_vmbox(form_data, user_data, success,
                        function(error_data, status) {
                            // Rollback
                            winkstart.request('extension.delete_device', {
                                account_id: winkstart.apps['voip'].account_id,
                                api_url: winkstart.apps['voip'].api_url,
                                device_id: _data.data.id
                            });
                            console.log('rolled back creation of device ' + _data.data.id);
                            error(error_data, status);
                        }
                    );
                },
                function(_data, status) {
                    if(typeof error == 'function') {
                        error(_data, status);
                    }
                }
            );
        },

        /**
         * Save a new voicemail box.
         *
         * @param {Object} form_data
         * @see load_save_prereqs
         * @param {Object} user_data - Data returned as a result of successful
         * user save.
         * @param {function} success - Function to call on success
         * @param {function} error - Function to call on error
         */
        save_vmbox: function(form_data, user_data, success, error) {
            var THIS = this,
                vmbox_data = {
                    mailbox: form_data.username,
                    name: form_data.username,
                    owner_id: user_data.id,
                    pin: form_data.password,
                    timezone: form_data.timezone
                };

            winkstart.request(true, 'extension.create_vmbox', {
                    account_id: winkstart.apps['voip'].account_id,
                    api_url: winkstart.apps['voip'].api_url,
                    data: vmbox_data
                },
                function(_data, status) {
                    THIS.save_callflow(form_data, user_data, _data.data, success,
                        function(error_data, status) {
                            // Rollback
                            winkstart.request('extension.delete_vmbox', {
                                account_id: winkstart.apps['voip'].account_id,
                                api_url: winkstart.apps['voip'].api_url,
                                vmbox_id: _data.data.id
                            });
                            console.log('rolled back creation of vmbox ' + _data.data.id);
                            error(error_data, status);
                        }
                    );
                },
                function(_data, status) {
                    if(typeof error == 'function') {
                        error(_data, status);
                    }
                }
            );
        },

        /**
         * Save a new callflow.
         *
         * @param {Object} form_data
         * @see load_save_prereqs
         * @param {Object} user_data - Data returned as a result of successful
         * user save.
         * @param {Object} vmbox_data - Data returned as a result of successful
         * vmbox save.
         * @param {function} success - Function to call on success
         * @param {function} error - Function to call on error
         */
        save_callflow: function(form_data, user_data, vmbox_data, success, error) {
            var callflow_data = {
                flow: {
                    data: {
                        id: user_data.id
                    },
                    module: 'user',
                    children: {
                        _: {
                            data: {
                                id: vmbox_data.id
                            },
                            module: 'voicemail',
                            children: {}
                        }
                    }
                },
                numbers: [
                    form_data.username
                ]
            };

            // Use phone number if set
            if(form_data.phone_number != '') {
                callflow_data.numbers.push(form_data.phone_number);
            }

            winkstart.request(true, 'extension.create_callflow', {
                    account_id: winkstart.apps['voip'].account_id,
                    api_url: winkstart.apps['voip'].api_url,
                    data: callflow_data
                },
                function(_data, status) {
                    success(_data.data, status);
                },
                function(_data, status) {
                    if(typeof error == 'function') {
                        error(_data, status);
                    }
                }
            );
        },

        /**
         * If an error object contains a data object, return that for error
         * display instead, simplifying the error displayed to the user.
         *
         * @param {function} error_fn - Function to be called with error
         * data and status code.
         */
        format_error: function(error_fn) {
            return function(_data, status) {
                if(typeof _data.data == 'object') {
                    error_fn(_data.data, status);
                }
                else {
                    error_fn(_data, status);
                }
            }
        }
    }
);
