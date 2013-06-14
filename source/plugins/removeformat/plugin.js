(function(ve) {
	//匹配要移除的标记
	var REMOVE_TAG_REG = /^(?:B|BIG|CODE|DEL|DFN|EM|FONT|I|INS|KBD|Q|SAMP|SMALL|SPAN|STRIKE|STRONG|SUB|SUP|TT|U|VAR)$/i;
	//要移除的属性样式
	var REMOVE_FORMAT_ATTRIBUTES = ["class", "style", "lang", "width", "height", "align", "hspace", "valign"];
	/**
	 * 移除格式
	 */
	ve.lang.Class('VEditor.plugin.RemoveFormat', {
		editor : null,
		curToolbarMode : 'default',
		button : null,
		init: function ( editor, url ) {

			var _this = this;
			this.editor = editor;
			editor.addCommand('removeformat', function(){
				_this.removeFormat();
			});
			var btn = editor.toolbarManager.createButton('removeformat', {
				'class': 'veRemoveFormat',
				title: '清除格式',
				text: '',
				cmd: 'removeformat'
			});
		},
		//执行去格式主函数
		removeFormat : function(){
			var bookmark, node, parent;
			var veRange = this.editor.getVERange();
			bookmark = veRange.createBookmark();
			node = bookmark.start;
			
			//切开始部分
			while(( parent = node.parentNode ) && !ve.dom.isBlock( parent )){
				veRange.breakParent( node,parent );
				clearEmptySibling( node );
			}
			
			if( bookmark.end ){
				//切结束部分
				node = bookmark.end;
				
				while(( parent = node.parentNode ) && !ve.dom.isBlock( parent )){
					veRange.breakParent( node, parent );
					clearEmptySibling( node );
				}

				//开始去除样式
				var current = ve.dom.getNextDomNode( bookmark.start, false, filter ),
					next;
				while ( current ) {
					if ( current == bookmark.end ) {
						break;
					}
					next = ve.dom.getNextDomNode( current, true, filter );
					if ( !ve.dtd.$empty[current.tagName.toUpperCase()] && !veRange.isBookmarkNode( current ) ) {
						if ( REMOVE_TAG_REG.test( current.tagName.toUpperCase() ) ) {
							ve.dom.remove( current, true );
						} else {
							//不能把list上的样式去掉
							if(!ve.dtd.$tableContent[current.tagName.toUpperCase()] && !ve.dtd.$list[current.tagName.toUpperCase()]){
								removeAttributes( current, REMOVE_FORMAT_ATTRIBUTES );
							}
							if ( isRedundantSpan( current ) ){
								ve.dom.remove( current, true );
							}
						}
					}
					current = next;
				}
			}
			var pN = bookmark.start.parentNode;
			
			if( ve.dom.isBlock(pN) && !ve.dtd.$tableContent[pN.tagName.toUpperCase()] && !ve.dtd.$list[pN.tagName.toUpperCase()] ){
				removeAttributes(  pN,REMOVE_FORMAT_ATTRIBUTES );
			}

			if( bookmark.end && ve.dom.isBlock( pN = bookmark.end.parentNode ) && !ve.dtd.$tableContent[pN.tagName.toUpperCase()] && !ve.dtd.$list[pN.tagName.toUpperCase()] ){
				removeAttributes(  pN,REMOVE_FORMAT_ATTRIBUTES );
			}
			veRange.moveToBookmark( bookmark );
			//清除冗余的代码 <b><bookmark></b>
			var node = veRange.startContainer,
				tmp,
				collapsed = veRange.collapsed;
			while( node.nodeType == 1  && ve.dtd.$removeEmpty[node.tagName.toUpperCase()] ){
				tmp = node.parentNode;
				veRange.setStartBefore(node);
				//更新结束边界
				if( veRange.startContainer === veRange.endContainer ){
					veRange.endOffset--;
				}
				ve.dom.remove(node);
				node = tmp;
			}

			if( !collapsed ){
				node = veRange.endContainer;
				while( node.nodeType == 1  && ve.dtd.$removeEmpty[node.tagName.toUpperCase()] ){
					tmp = node.parentNode;
					veRange.setEndBefore(node);
					ve.dom.remove(node);
					node = tmp;
				}
			}
			veRange.select();
		}
	});
	ve.plugin.register('removeformat', VEditor.plugin.RemoveFormat);

	/**
	 * 过滤元素节点
	 */
	var filter = function( node ) {
		return node.nodeType == 1;
	};
	/**
	 * 清除node节点左右兄弟为空的inline节点
	 * @name clearEmptySibling
	 * @grammar clearEmptySibling(node)
	 * @grammar clearEmptySibling(node,ignoreNext)  //ignoreNext指定是否忽略右边空节点
	 * @grammar clearEmptySibling(node,ignoreNext,ignorePre)  //ignorePre指定是否忽略左边空节点
	 * @example
	 * <b></b><i></i>xxxx<b>bb</b> --> xxxx<b>bb</b>
	 */
	var	clearEmptySibling = function (node, ignoreNext, ignorePre) {
		function clear(next, dir) {
			var tmpNode;
			while (next && !isBookmarkNode(next) && (isEmptyInlineElement(next)
				//这里不能把空格算进来会吧空格干掉，出现文字间的空格丢掉了
				|| !new RegExp('[^\t\n\r' + ve.caretChar + ']').test(next.nodeValue) )) {
				tmpNode = next[dir];
				ve.dom.remove(next);
				next = tmpNode;
			}
		}
		!ignoreNext && clear(node.nextSibling, 'nextSibling');
		!ignorePre && clear(node.previousSibling, 'previousSibling');
	};
	/**
	 * 删除节点node上的属性attrNames，attrNames为属性名称数组
	 * @name  removeAttributes
	 * @grammar removeAttributes(node,attrNames)
	 * @example
	 * //Before remove
	 * <span style="font-size:14px;" id="test" name="followMe">xxxxx</span>
	 * //Remove
	 * removeAttributes(node,["id","name"]);
	 * //After remove
	 * <span style="font-size:14px;">xxxxx</span>
	 */
	var	removeAttributes = function ( node, attrNames ) {
		//需要修正属性名的属性
		var attrFix = ve.ua.ie && ve.ua.ie < 9 ? {
				tabindex:"tabIndex",
				readonly:"readOnly",
				"for":"htmlFor",
				"class":"className",
				maxlength:"maxLength",
				cellspacing:"cellSpacing",
				cellpadding:"cellPadding",
				rowspan:"rowSpan",
				colspan:"colSpan",
				usemap:"useMap",
				frameborder:"frameBorder"
			} : {
				tabindex:"tabIndex",
				readonly:"readOnly"
			},
		attrNames = ve.lang.isArray( attrNames ) ? attrNames : ve.string.trim( attrNames ).replace(/[ ]{2,}/g,' ').split(' ');
		for (var i = 0, ci; ci = attrNames[i++];) {
			ci = attrFix[ci] || ci;
			switch (ci) {
				case 'className':
					node[ci] = '';
					break;
				case 'style':
					node.style.cssText = '';
					!ve.ua.ie && node.removeAttributeNode(node.getAttributeNode('style'))
			}
			node.removeAttribute(ci);
		}
	};
	/**
	 * 检查节点node是否是空inline节点
	 * @name  isEmptyInlineElement
	 * @grammar   isEmptyInlineElement(node)  => 1|0
	 * @example
	 * <b><i></i></b> => 1
	 * <b><i></i><u></u></b> => 1
	 * <b></b> => 1
	 * <b>xx<i></i></b> => 0
	 */
	var	isEmptyInlineElement = function ( node ) {
		if (node.nodeType != 1 || ve.dtd.$removeEmpty[ node.tagName.toUpperCase() ]) {
			return 0;
		}
		node = node.firstChild;
		while (node) {
			//如果是创建的bookmark就跳过
			if (isBookmarkNode(node)) {
				return 0;
			}
			if (node.nodeType == 1 && !isEmptyInlineElement(node) ||
				node.nodeType == 3 && !isWhitespace(node)
				) {
				return 0;
			}
			node = node.nextSibling;
		}
		return 1;
	};
	/**
	 * 检测节点node是否为空节点（包括空格、换行、占位符等字符）
	 * @name  isWhitespace
	 * @grammar  isWhitespace(node)  => true|false
	 */
	var	isWhitespace = function ( node ) {
		return !new RegExp('[^ \t\n\r' + ve.caretChar + ']').test(node.nodeValue);
	};
	/**
	 * 检测节点node是否属于bookmark节点
	 * @name isBookmarkNode
	 * @grammar isBookmarkNode(node)  => true|false
	 */
	var	isBookmarkNode = function ( node ) {
		return node.nodeType == 1 && node.id && /^veditor_bookmark_/i.test(node.id);
	};
	/**
	 * 判断node是否为多余的节点
	 * @name isRenundantSpan
	 */
	var	isRedundantSpan = function( node ) {
		if (node.nodeType == 3 || node.tagName.toUpperCase() != 'SPAN'){
			return 0;
		}
		if (ve.ua.ie) {
			//ie 下判断实效，所以只能简单用style来判断
			//return node.style.cssText == '' ? 1 : 0;
			var attrs = node.attributes;
			if ( attrs.length ) {
				for ( var i = 0,l = attrs.length; i<l; i++ ) {
					if ( attrs[i].specified ) {
						return 0;
					}
				}
				return 1;
			}
		}
		return !node.attributes.length;
	};
}) (VEditor);