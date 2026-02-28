import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import Migration "migration";

(with migration = Migration.run)
actor {
  ///////////////////////////
  // Types & Comparers
  ///////////////////////////

  type Column = {
    id : Nat;
    name : Text;
    cardIds : List.List<Nat>;
  };

  module Column {
    public func compare(c1 : Column, c2 : Column) : Order.Order {
      Nat.compare(c1.id, c2.id);
    };
  };

  type Card = {
    id : Nat;
    title : Text;
    description : ?Text;
    columnId : Nat;
    assignedUserId : ?Nat;
  };

  module Card {
    public func compare(c1 : Card, c2 : Card) : Order.Order {
      Nat.compare(c1.id, c2.id);
    };
  };

  type User = {
    id : Nat;
    name : Text;
    pinHash : Text;
  };

  module User {
    public func compare(u1 : User, u2 : User) : Order.Order {
      Nat.compare(u1.id, u2.id);
    };
  };

  type Revision = {
    id : Nat;
    actorName : Text;
    timestamp : Int;
    revisionType : Text;
    description : Text;
    cardId : ?Nat;
  };

  module Revision {
    public func compareByTimestamp(rev1 : Revision, rev2 : Revision) : Order.Order {
      Int.compare(rev2.timestamp, rev1.timestamp);
    };
  };

  ///////////////////////////
  // State
  ///////////////////////////

  let users = Map.empty<Nat, User>();
  let columns = Map.empty<Nat, Column>();
  let cards = Map.empty<Nat, Card>();
  let revisions = Map.empty<Nat, Revision>();

  var nextUserId = 1;
  var nextColumnId = 1;
  var nextCardId = 1;
  var nextRevisionId = 1;

  var adminPinHash : ?Text = null;

  ///////////////////////////
  // User Management
  ///////////////////////////

  public shared ({ caller }) func createUser(name : Text, pinHash : Text) : async Nat {
    let userId = nextUserId;
    let newUser : User = {
      id = userId;
      name;
      pinHash;
    };
    users.add(userId, newUser);
    nextUserId += 1;
    userId;
  };

  public shared ({ caller }) func deleteUser(id : Nat) : async () {
    switch (users.get(id)) {
      case (null) { Runtime.trap("User not found") };
      case (?_) {
        users.remove(id);
      };
    };
  };

  func getUserName(userId : Nat) : Text {
    switch (users.get(userId)) {
      case (null) { "Unknown" };
      case (?user) { user.name };
    };
  };

  ///////////////////////////
  // Pin Management
  ///////////////////////////

  public query ({ caller }) func verifyPin(userId : Nat, pinHash : Text) : async Bool {
    switch (users.get(userId)) {
      case (null) { false };
      case (?user) {
        user.pinHash == pinHash;
      };
    };
  };

  public shared ({ caller }) func changeUserPin(
    userId : Nat,
    oldPinHash : Text,
    newPinHash : Text,
  ) : async () {
    switch (users.get(userId)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) {
        if (user.pinHash != oldPinHash) {
          Runtime.trap("Invalid old PIN");
        };
        users.add(userId, { user with pinHash = newPinHash });

        logRevision(
          userId,
          "change_pin",
          "User '" # user.name # "' changed PIN",
          null,
        );
      };
    };
  };

  public shared ({ caller }) func resetUserPin(
    userId : Nat,
    adminPinHash : Text,
    newPinHash : Text,
  ) : async () {
    switch (users.get(userId)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) {
        if (not verifyAdminPin(adminPinHash)) {
          Runtime.trap("Invalid admin PIN");
        };

        users.add(userId, { user with pinHash = newPinHash });

        logRevision(
          0,
          "reset_pin",
          "Admin reset PIN for user '" # user.name # "'",
          null,
        );
      };
    };
  };

  public shared ({ caller }) func setAdminPin(newPinHash : Text) : async () {
    switch (adminPinHash) {
      case (null) {
        adminPinHash := ?newPinHash;
      };
      case (?_) {
        Runtime.trap("Admin PIN already set");
      };
    };
  };

  func verifyAdminPin(pinHash : Text) : Bool {
    switch (adminPinHash) {
      case (null) { false };
      case (?storedHash) { storedHash == pinHash };
    };
  };

  public query ({ caller }) func getUsers() : async [User] {
    users.values().toArray().sort();
  };

  ///////////////////////////
  // Column Management
  ///////////////////////////

  public func initBoard() : async () {
    if (columns.isEmpty()) {
      addDefaultColumn("To Do");
      addDefaultColumn("In Progress");
      addDefaultColumn("Done");
    };
  };

  func addDefaultColumn(name : Text) {
    let column : Column = {
      id = nextColumnId;
      name;
      cardIds = List.empty<Nat>();
    };
    columns.add(nextColumnId, column);
    nextColumnId += 1;
  };

  public shared ({ caller }) func createColumn(name : Text, actorUserId : Nat) : async Nat {
    let columnId = nextColumnId;
    let column : Column = {
      id = columnId;
      name;
      cardIds = List.empty<Nat>();
    };
    columns.add(columnId, column);
    nextColumnId += 1;

    logRevision(
      actorUserId,
      "create_column",
      "Column '" # name # "' created by " # getUserName(actorUserId),
      null,
    );
    columnId;
  };

  public shared ({ caller }) func renameColumn(
    columnId : Nat,
    newName : Text,
    actorUserId : Nat,
  ) : async () {
    switch (columns.get(columnId)) {
      case (null) { Runtime.trap("Column not found") };
      case (?column) {
        columns.add(columnId, { column with name = newName });

        logRevision(
          actorUserId,
          "rename_column",
          "Column '" # column.name # "' renamed to '" # newName # "' by " # getUserName(actorUserId),
          null,
        );
      };
    };
  };

  public shared ({ caller }) func deleteColumn(
    columnId : Nat,
    actorUserId : Nat,
  ) : async () {
    switch (columns.get(columnId)) {
      case (null) { Runtime.trap("Column not found") };
      case (?column) {
        columns.remove(columnId);
        logRevision(
          actorUserId,
          "delete_column",
          "Column '" # column.name # "' deleted by " # getUserName(actorUserId),
          null,
        );
      };
    };
  };

  public shared ({ caller }) func reorderColumns(newOrder : [Nat], actorUserId : Nat) : async () {
    let reorderedMap = Map.empty<Nat, Column>();
    for (colId in newOrder.values()) {
      switch (columns.get(colId)) {
        case (null) { Runtime.trap("Invalid column id encountered") };
        case (?column) {
          reorderedMap.add(colId, column);
        };
      };
    };
    columns.clear();
    for (column in reorderedMap.values()) {
      columns.add(column.id, column);
    };

    logRevision(
      actorUserId,
      "reorder_columns",
      "Columns reordered by " # getUserName(actorUserId),
      null,
    );
  };

  ///////////////////////////
  // Card Management
  ///////////////////////////

  public shared ({ caller }) func createCard(
    title : Text,
    description : ?Text,
    columnId : Nat,
    actorUserId : Nat,
  ) : async Nat {
    switch (columns.get(columnId)) {
      case (null) { Runtime.trap("Column not found") };
      case (?column) {
        let cardId = nextCardId;
        let card : Card = {
          id = cardId;
          title;
          description;
          columnId;
          assignedUserId = null;
        };

        let updatedCards = column.cardIds.clone();
        updatedCards.add(cardId);

        cards.add(cardId, card);
        columns.add(columnId, { column with cardIds = updatedCards });
        nextCardId += 1;

        logRevision(
          actorUserId,
          "create_card",
          "Card '" # title # "' created in column '" # column.name # "' by " # getUserName(actorUserId),
          ?cardId,
        );
        cardId;
      };
    };
  };

  public shared ({ caller }) func updateCard(
    cardId : Nat,
    title : Text,
    description : ?Text,
    actorUserId : Nat,
  ) : async () {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?card) {
        cards.add(
          cardId,
          { card with title; description },
        );

        logRevision(
          actorUserId,
          "update_card",
          getUserName(actorUserId) # " updated card '" # title # "'",
          ?cardId,
        );
      };
    };
  };

  public shared ({ caller }) func deleteCard(
    cardId : Nat,
    actorUserId : Nat,
  ) : async () {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?card) {
        cards.remove(cardId);

        switch (columns.get(card.columnId)) {
          case (null) { Runtime.trap("Column not found") };
          case (?column) {
            let updatedCards = column.cardIds.filter(func(id) { id != cardId });
            columns.add(card.columnId, { column with cardIds = updatedCards });
          };
        };

        logRevision(
          actorUserId,
          "delete_card",
          "Card '" # card.title # "' deleted by " # getUserName(actorUserId),
          ?cardId,
        );
      };
    };
  };

  public shared ({ caller }) func moveCard(
    cardId : Nat,
    targetColumnId : Nat,
    newPosition : Nat,
    actorUserId : Nat,
  ) : async () {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?card) {
        let sourceColumnId = card.columnId;
        switch (columns.get(sourceColumnId)) {
          case (null) { Runtime.trap("Original column not found") };
          case (?oldColumn) {
            let updatedOldCards = oldColumn.cardIds.filter(func(id) { id != cardId });
            columns.add(sourceColumnId, { oldColumn with cardIds = updatedOldCards });

            switch (columns.get(targetColumnId)) {
              case (null) { Runtime.trap("Target column not found") };
              case (?newColumn) {
                let newCards = List.empty<Nat>();
                var pos = 0;
                for (id in newColumn.cardIds.values()) {
                  if (pos == newPosition) {
                    newCards.add(cardId);
                  };
                  newCards.add(id);
                  pos += 1;
                };
                if (newPosition >= newCards.size()) {
                  newCards.add(cardId);
                };

                cards.add(cardId, { card with columnId = targetColumnId });
                columns.add(targetColumnId, { newColumn with cardIds = newCards });

                logRevision(
                  actorUserId,
                  "move_card",
                  getUserName(actorUserId) # " moved card '" # card.title # "' from '" # oldColumn.name # "' to '" # newColumn.name # "'",
                  ?cardId,
                );
              };
            };
          };
        };
      };
    };
  };

  public shared ({ caller }) func assignCard(
    cardId : Nat,
    userId : ?Nat,
    actorUserId : Nat,
  ) : async () {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?card) {
        cards.add(cardId, { card with assignedUserId = userId });

        let actorName = getUserName(actorUserId);
        let assignee = switch (userId) {
          case (null) { "unassigned" };
          case (?id) { getUserName(id) };
        };

        logRevision(
          actorUserId,
          "assign_card",
          actorName # " assigned card '" # card.title # "' to " # assignee,
          ?cardId,
        );
      };
    };
  };

  ///////////////////////////
  // Data Retrieval
  ///////////////////////////

  type ColumnView = {
    id : Nat;
    name : Text;
    cardIds : [Nat];
  };

  module ColumnView {
    public func fromColumn(column : Column) : ColumnView {
      {
        id = column.id;
        name = column.name;
        cardIds = column.cardIds.toArray();
      };
    };

    public func fromColumns(columns : [Column]) : [ColumnView] {
      columns.map(fromColumn);
    };
  };

  public query ({ caller }) func getColumns() : async [ColumnView] {
    ColumnView.fromColumns(columns.values().toArray().sort());
  };

  public query ({ caller }) func getCards() : async [Card] {
    cards.values().toArray().sort();
  };

  ///////////////////////////
  // Revision Log
  ///////////////////////////

  public query ({ caller }) func getRevisions() : async [Revision] {
    revisions.values().toArray().sort(Revision.compareByTimestamp);
  };

  public query ({ caller }) func getCardRevisions(cardId : Nat) : async [Revision] {
    revisions.values().toArray().filter(
      func(rev) {
        switch (rev.cardId) {
          case (null) { false };
          case (?id) { id == cardId };
        };
      }
    ).sort(Revision.compareByTimestamp);
  };

  func logRevision(
    actorUserId : Nat,
    revType : Text,
    description : Text,
    cardId : ?Nat,
  ) {
    let rev : Revision = {
      id = nextRevisionId;
      actorName = getUserName(actorUserId);
      timestamp = Time.now();
      revisionType = revType;
      description;
      cardId;
    };
    revisions.add(nextRevisionId, rev);
    nextRevisionId += 1;
  };

  // This function could be expanded for migration or history purposes
  public shared ({ caller }) func clearRevisions() : async () {
    revisions.clear();
  };
};
