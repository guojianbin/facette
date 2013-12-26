
/* Input */

var INPUT_CHECK_CALLBACKS    = {},
    INPUT_COMPLETE_CALLBACKS = {},
    INPUT_REQUESTS           = {},
    INPUT_TIMEOUTS           = {},

    $inputTemplate;

function inputGetSources(input, args) {
    var $field,
        items,
        sources = {};

    args = args || {};

    if (typeof input == 'string')
        input = inputMatch(input);

    $field = input.children(':input');

    // Set filter if any
    if ($field.val())
        args.filter = $field.val() + '*';

    // Get sources requests
    items = $.map((input.opts('input').sources || '').split(','), $.trim) || [];

    $.each(items, function (i, item) {
        /*jshint unused: true */

        sources[item] = {
            url: '/' + item,
            type: 'GET',
            data: args
        };
    });

    return sources;
}

function inputHandleClick(e) {
    var $item = $(e.target).closest('[data-menuitem]'),
        $input = $(e.target).closest('[data-input]'),
        value = $item.data('value');

    $input.children(':input')
        .data('value', value)
        .val(value.name)
        .focus();

    menuToggle($input.attr('data-input'), false);
}

function inputHandleFocus(e) {
    // Trigger change if value modified
    if (e.target.value != e.target._lastValue) {
        menuMatch($(e.target).closest('[data-input]').attr('data-input')).trigger({
            type: 'keydown',
            which: EVENT_KEY_ENTER
        });
    }

    // Reset completion state
    e.target._lastValue = null;

    // Abort current requests
    if (!INPUT_REQUESTS[name])
        return;

    $.each(INPUT_REQUESTS[name], function (i, request) {
        /*jshint unused: true */
        request.abort();
    });
}

function inputHandleKey(e) {
    var $input = $(e.target).closest('[data-input]');

    if (($input.opts('input').check || '').trim().toLowerCase() == 'true')
        inputHandleKeyCheck(e);
    else if ($input.opts('input').sources)
        inputHandleKeyComplete(e);
}

function inputHandleKeyCheck(e) {
    var $input = $(e.target).closest('[data-input]'),
        name = $input.attr('data-input');

    if (INPUT_TIMEOUTS[name])
        clearTimeout(INPUT_TIMEOUTS[name]);

    INPUT_TIMEOUTS[name] = setTimeout(function () {
        if (INPUT_CHECK_CALLBACKS[name])
            INPUT_CHECK_CALLBACKS[name]($input);
    }, 1000);
}

function inputHandleKeyComplete(e) {
    var $target = $(e.target),
        $input = $target.closest('[data-input]'),
        $menu,
        length,
        name = $input.attr('data-input'),
        value;

    if (e.which == EVENT_KEY_SHIFT) {
        return;
    } else if (e.which == EVENT_KEY_ENTER) {
        // Validate completion
        e.target._lastValue = e.target.value;
        e.target.setSelectionRange(e.target.value.length, e.target.value.length);

        $target.trigger('change');

        return;
    } else if (e.which == EVENT_KEY_TAB) {
        if (!e.target._lastValue)
            return;

        $target.trigger({
            type: 'keyup',
            which: EVENT_KEY_ENTER
        });

        return;
    } else if (e.which == EVENT_KEY_ESCAPE) {
        // Reset completion field
        e.target.value = e.target.value !== e.target._lastValue ? e.target._lastValue : '';
        e.target._lastValue = null;

        $target
            .removeData('value');

        if (!$target.val())
            $target.trigger('change');

        return;
    } else if (e.which == EVENT_KEY_UP || e.which == EVENT_KEY_DOWN) {
        $menu  = menuMatch(name);
        length = e.target._lastValue ? e.target._lastValue.length : 0;
        value  = ($menu.find('[data-menuitem].selected').data('value') || {}).name;

        if (!value)
            return;

        e.target.value = value;
        e.target.setSelectionRange(length, value.length);

        return;
    }

    if (INPUT_TIMEOUTS[name])
        clearTimeout(INPUT_TIMEOUTS[name]);

    // Stop if value didn't change or empty
    if (e.target.value == e.target._lastValue) {
        return;
    } else if (!e.target.value) {
        e.target._lastValue = null;
        $target.removeData('value');
        return;
    }

    INPUT_TIMEOUTS[name] = setTimeout(function () {
        var $menu = menuMatch(name),
            items = {},
            sources;

        // Get sources requests
        if (!INPUT_COMPLETE_CALLBACKS[name]) {
            sources = inputGetSources($input) || [];
        } else {
            sources = INPUT_COMPLETE_CALLBACKS[name]($input) || [];
        }

        if (sources.length === 0)
            return;

        INPUT_REQUESTS[name] = [];

        // Prepare menu
        menuSay($menu, 'Loading...');
        menuEmpty($menu);

        // Execute completion requests
        $.each(sources, function (i, source) {
            items[i] = null;

            source.beforeSend = function (xhr) {
                xhr._source = i;
            };

            source.success = function (data, textStatus, xhr) {
                /*jshint unused: true */

                items[xhr._source] = data;
            };

            INPUT_REQUESTS[name].push($.ajax(source));
        });

        // Call autocomplete callback when all sources have been fetched
        $.when.apply(null, INPUT_REQUESTS[name]).then(function () {
            inputUpdate($input, items);
            delete INPUT_REQUESTS[name];
        });

        // Update completion field
        e.target._lastValue = e.target.value;
    }, 500);
}

function inputInit(element) {
    var $input,
        $element = $(element),
        $menu;

    element.value = element._lastValue = '';

    $input = $inputTemplate.clone().insertBefore(element)
        .attr('class', $element.attr('class'))
        .attr('data-input', $element.attr('data-input'))
        .attr('data-inputopts', $element.attr('data-inputopts'));

    $element.detach().appendTo($input)
        .removeAttr('class')
        .removeAttr('data-input')
        .removeAttr('data-inputopts');

    if ($input.opts('input').sources) {
        element.setAttribute('autocomplete', 'off');

        // Create new menu
        $menu = menuCreate(element.getAttribute('data-input')).appendTo($input)
            .attr('data-menu', $input.attr('data-input'));

        // Make width consistent
        $menu.css('min-width', $input.width());
    }
}

function inputMatch(name) {
    return $('[data-input="' + name + '"]');
}

function inputRegisterCheck(name, callback) {
    // Register new check callback
    INPUT_CHECK_CALLBACKS[name] = callback;
}

function inputRegisterComplete(name, callback) {
    // Register new autocomplete callback
    INPUT_COMPLETE_CALLBACKS[name] = callback;
}

function inputSetupInit() {
    // Get main objects
    $inputTemplate = $('[data-input=template]').detach();

    // Initialize input items
    $('[data-input]').each(function () { inputInit(this); });
}

function inputUpdate(input, data) {
    var $menu,
        count,
        field,
        name;

    if (typeof input == 'string')
        input = inputMatch(input);

    name  = input.attr('data-input');
    $menu = menuMatch(name);

    menuSay($menu, null);

    count = 0;

    $.each(data, function (source, entries) {
        if (!entries)
            return;

        $.each(entries, function (i, entry) {
            /*jshint unused: true */

            if (typeof entry == 'string') {
                entry = {
                    name: entry,
                    source: source
                };
            } else {
                entry.source = source;
            }

            menuAppend($menu)
                .attr('data-menuitem', name + count)
                .attr('data-menusource', source)
                .data('value', entry)
                .text(entry.name);

            count++;
        });
    });

    menuToggle($menu, true);

    if ($menu.find('[data-menuitem]').length === 0) {
        menuSay($menu, 'No match', 'warn');
    } else {
        field = input.children(':input').get(0);

        // Select first item from menu
        input.trigger({target: field, type: 'keydown', which: EVENT_KEY_DOWN});
        input.trigger({target: field, type: 'keyup', which: EVENT_KEY_DOWN});
    }
}

// Attach events
$body
    .on('click', '[data-input] [data-menuitem]', inputHandleClick)
    .on('focusout', '[data-input] :input', inputHandleFocus)
    .on('keyup', '[data-input] :input', inputHandleKey);

// Register setup callbacks
setupRegister(SETUP_CALLBACK_INIT, inputSetupInit);
