(items: any[], useUpsert: boolean, ignoreInsertErrors: boolean) => {
  const start = new Date();
  // @ts-expect-error: The getContext function will exist within the stored procedure runtime
  const context = getContext();
  const collection = context.getCollection();
  const collectionLink = collection.getSelfLink();
  const documentFn = useUpsert ? collection.upsertDocument : collection.createDocument;
  let count = 0;
  const upsertNext = (): void => {
    const accepted = (count < items.length) && documentFn(collectionLink, items[count], (err) => {
      if (err) {
        if (err.number !== COSMOS_ITEM_EXISTS || !ignoreInsertErrors) {
          throw err;
        }
      }
      ++count;
      upsertNext();
    });

    if (!accepted) {
      context.getResponse().setBody({ processed: count, duration: (new Date().getTime()) - start.getTime() });
    }
  }
  upsertNext();
}

const COSMOS_ITEM_EXISTS = 409;
