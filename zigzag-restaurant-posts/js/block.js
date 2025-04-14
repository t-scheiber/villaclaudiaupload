/**
 * ZigZag Restaurant Posts Gutenberg Block
 */
(function(blocks, editor, components, i18n, element) {
    var el = element.createElement;
    var __ = i18n.__;
    var InspectorControls = editor.InspectorControls;
    var TextControl = components.TextControl;
    var RangeControl = components.RangeControl;
    var PanelBody = components.PanelBody;
    var ServerSideRender = components.ServerSideRender;

    // Register the block
    blocks.registerBlockType('zigzag-restaurant-posts/restaurants-block', {
        title: __('ZigZag Restaurants', 'zigzag-restaurant-posts'),
        icon: 'grid-view',
        category: 'widgets',
        
        attributes: {
            category: {
                type: 'string',
                default: ''
            },
            postsPerPage: {
                type: 'number',
                default: 6
            }
        },
        
        edit: function(props) {
            return [
                // Inspector controls
                el(InspectorControls, { key: 'inspector' },
                    el(PanelBody, {
                            title: __('Display Settings', 'zigzag-restaurant-posts'),
                            initialOpen: true
                        },
                        el(TextControl, {
                            label: __('Category Slug', 'zigzag-restaurant-posts'),
                            value: props.attributes.category,
                            onChange: function(value) {
                                props.setAttributes({ category: value });
                            }
                        }),
                        el(RangeControl, {
                            label: __('Number of Restaurants', 'zigzag-restaurant-posts'),
                            value: props.attributes.postsPerPage,
                            min: 1,
                            max: 20,
                            onChange: function(value) {
                                props.setAttributes({ postsPerPage: value });
                            }
                        })
                    )
                ),
                
                // Preview in editor
                el('div', { className: props.className },
                    el('div', { className: 'zigzag-restaurants-block-editor' },
                        el('h2', {}, __('ZigZag Restaurants', 'zigzag-restaurant-posts')),
                        el('p', {}, __('This block will display your restaurant posts in a zig-zag layout.', 'zigzag-restaurant-posts')),
                        el('div', { className: 'zigzag-restaurants-preview' },
                            el(ServerSideRender, {
                                block: 'zigzag-restaurant-posts/restaurants-block',
                                attributes: props.attributes
                            })
                        )
                    )
                )
            ];
        },
        
        save: function() {
            // Server-side rendering with PHP
            return null;
        }
    });
}(
    window.wp.blocks,
    window.wp.blockEditor,
    window.wp.components,
    window.wp.i18n,
    window.wp.element
)); 