module.exports = {
    removeDuplicates (arr) {
        return arr.filter ((el, pos, a) => (a.indexOf(el) == pos) && el );
    },
    getRegexCaptures (content, regex, callback) {
        let matches, result = [];

        while ((matches = regex.exec(content)) !== null) {
            if (matches.index === regex.lastIndex) regex.lastIndex++; // This is necessary to avoid infinite loops with zero-width matches
            callback (matches.splice(1), result);
        }

        return result;
    },
    prettifyList (input) { // "a, b ,,b   ,,  c,d,d" ==> [a, b, c, d]
        let tags = input
            .split (',')
            .map (s => s.trim())
            .filter (s => s != '');

        return this.removeDuplicates (tags);
    },
    isEqual (str1, str2) {
        return str1.toLowerCase().trim() === str2.toLowerCase().trim();
    },
    clock (start) {
        if ( !start ) return process.hrtime();
        var end = process.hrtime(start);
        return Math.round((end[0]*1000) + (end[1]/1000000));
    },
    swap (arr, a, b) {
        let temp = arr[a];
        arr[a] = arr[b];
        arr[b] = temp;
        return arr;
    },

    //===================================================================================================
    //      THESE FUNCTIONS DEPEND ON A CURRENT NOTEKEEPER REALISATION
    //===================================================================================================
    getUsedTags (base) {
        let tagsArr = base.reduce ((acc, record) => (acc.concat (record.tags)), []);

        return this.removeDuplicates (tagsArr);
    },
    concatUniqText (acc, addition) {
        if (!acc) return addition;
        if (!addition) return acc;

        if (addition.startsWith (acc))
            return addition;

        return acc +'\n\n'+ addition;
    },
    concatUniqTags (tags1, tags2) { // Returns Array !
        if (typeof tags1 == 'string') tags1 = tags1.split(', ');
        if (typeof tags2 == 'string') tags2 = tags2.split(', ');

        if (!tags1.length) return tags2;
        if (!tags2.length) return tags1;

        const res = tags1.concat (tags2);
        return this.removeDuplicates (res);
    },
    searchName (base, name) {
        return name ?
            base.findIndex (record => this.isEqual (record.name, name) ) :
            -1;     // empty name equals to uniq name
    },

    // TREE VIEW
    buildTree (base, rootId) {
        const isEqual = this.isEqual;
        let tree = [];  
        let rootRecord = { name: 'root', _childrenIds: [] };
        // specifiedRoot -- a root specified by a command like "tree js" (not the main root)
        let specifiedRoot = rootId==null ? rootRecord : base[rootId];
        let isCircular = false;
        let stack = [];


        base.root = rootRecord;
        specifiedRoot.level = 0;
        base.forEach ((record, i) => { // set IDs, parents and children
            if (!record.text.trim()) return; // jump over empty records
            record._id = i;
            record._parentsIds = getParentsIds (record.tags, base);  // find Ids of all parents (tags)
            setChild (record, base);  // register the record in each parent's record as a child
        });

        checkCircular (base.root);
        sortChildren (specifiedRoot, base);
        makeTree (specifiedRoot, base, tree);
        clearBaseIds (base);

        
        return tree;


        function getParentsIds (parents, base) {
            let len = parents.length;
            if (!len || !parents[0]) return ['root'];

            let parentIds = Array (len);
            for (let i=0; i<len; i++) {
                let tag = parents[i];
                let id = base.findIndex (e => isEqual (e.name, tag));

                if (id !== -1) parentIds[i] = id;
                else parentIds[i] = 'root'; 
            };
            return parentIds;
        }
        function setChild (record, base) {
            let parents = record._parentsIds;
            for (let i=0; i<parents.length; i++) {
                let parentId = parents[i];
                let parent = base[parentId];
                if (!parent._childrenIds) parent._childrenIds = [record._id];
                else parent._childrenIds.push (record._id);
            }
        }
        
        /*
        function setLevels (specifiedRoot, base) {
            if (isCircular) return;

            let level = specifiedRoot.level || 0;
            if (!specifiedRoot.level && specifiedRoot._id >= 0) { // not a global Root. It will be shown.
                level = 1;
            }
            if (!specifiedRoot._childrenIds) return tree; // exit from a recursion


            if (level > 100) { // Catching circular links
                loop.push ({name: specifiedRoot.name, parents: specifiedRoot.tags, id: specifiedRoot._id});
            }
            if (level > 106) {
                if (loop.findIndex (e => e.name === specifiedRoot.name) >= 0) {
                    isCircular = true;
                    console.error ('Circular link is found!');

                    const victim = loop.find (record => { // searching a record with a parent which is outside of the loop
                        return record.parents.find (parent => {
                            const found = loop.find (e => isEqual (e.name, parent));
                            console.log(found);
                            if (!found) return true; 
                        });
                    });
                    const errorTags = victim.parents.filter (parent => { // wrong tag
                        return loop.find (e => isEqual (e.name, parent))
                    });


                    tree = [ base[victim.id] ];
                    tree.error = errorTags.join(', ');
                    return;
                }
            }

            
            specifiedRoot._childrenIds.forEach (childId => { // set children levels
                let child = base[childId];
                child.level = level + 1;

                setLevels (child, base);
            });
        }
        */
        
        function checkCircular (node) {
            const newStackTop = {id: node._id, i: 0};
            let stackTop = stack[stack.length-1];

            if (!stackTop) stack.push (newStackTop); // root

            let children = node._childrenIds;
            if (children) {
                if (stackTop.id !== node.id) {
                    stack.push (newStackTop)
                }
                if (children.length > stackTop.i) {
                    const nextChildId = children[stackTop.i];
                    const nextChild = base[nextChildId];
                    checkCircular (nextChild);
                    return;
                } else {
                    stack.pop();
                }
            }
            stackTop.i++;
            const parentId = stackTop.id;
            const parent = base[parentId];
            checkCircular (parent);

            if (stack.length > 30) debugger;
        }

        function sortChildren (specifiedRoot, base) {
            let children = specifiedRoot._childrenIds;
            if (!children) return;

            children.sort ((a,b) => base[a].name > base[b].name ? 1 : -1)

            children.forEach (childId => {                
                sortChildren (base[childId], base);
            });
        }
        function makeTree (specifiedRoot, base, tree) {
            if (isCircular) return;

            let level = specifiedRoot.level || 0;
            if (!specifiedRoot.level && specifiedRoot._id >= 0) { // not a global Root. It will be shown.
                level = 1;
            }

            // Only base.root does not have an "_id" property
            // SpecifiedRoot has "_id" and it differs it from the base.root
            if (specifiedRoot.level === 0 && specifiedRoot._id != undefined) {
                const parentNames = specifiedRoot
                    ._parentsIds.map (id => base[id].name);

                tree.push ({
                    name: specifiedRoot.name,
                    text: specifiedRoot.text,
                    modifier: 1,
                    parentNames,
                });
            }
            
            if (!specifiedRoot._childrenIds) return tree; // no children? finish it

            specifiedRoot._childrenIds.forEach (childId => { // pushing children
                let child = base[childId];
                child.level = level + 1;

                tree.push ({
                    name: child.name,
                    text: child.text,
                    modifier: child.level,
                });

                makeTree (child, base, tree);
            });
        }
        function clearBaseIds (base) {
            base.forEach (record => {
                record._parentsIds = undefined;
                record._childrenIds = undefined;
            });
        }
    },

    // CONSOLE
    LOG (msg) {
        G.isLogging && console.log ('\x1b[2m%s\x1b[0m', msg);
    },
    ERR (msg) {
        console.error ('\x1b[31m%s\x1b[0m', msg);
    },
}
