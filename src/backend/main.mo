import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";



actor {
  ///////////////////////////
  // Types
  ///////////////////////////

  type Project = {
    id : Nat;
    name : Text;
    swimlanesEnabled : Bool;
  };

  type Column = {
    id : Nat;
    name : Text;
    projectId : Nat;
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
    projectId : Nat;
    assignedUserId : ?Nat;
    tags : [Nat];
    dueDate : ?Int;
    createdAt : Int;
    swimlaneId : ?Nat;
    isArchived : Bool;
    archivedAt : ?Int;
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
    isAdmin : Bool;
    isMasterAdmin : Bool;
    securityQuestion : ?Text;
    securityAnswerHash : ?Text;
  };
  module User {
    public func compare(u1 : User, u2 : User) : Order.Order {
      Nat.compare(u1.id, u2.id);
    };
  };

  type Tag = {
    id : Nat;
    projectId : Nat;
    name : Text;
    color : Text;
  };
  module Tag {
    public func compare(t1 : Tag, t2 : Tag) : Order.Order {
      Nat.compare(t1.id, t2.id);
    };
  };

  type Revision = {
    id : Nat;
    actorName : Text;
    timestamp : Int;
    revisionType : Text;
    description : Text;
    cardId : ?Nat;
    projectId : Nat;
  };
  module Revision {
    public func compareByTimestamp(rev1 : Revision, rev2 : Revision) : Order.Order {
      Int.compare(rev2.timestamp, rev1.timestamp);
    };
  };

  type Comment = {
    id : Nat;
    cardId : Nat;
    authorId : Nat;
    authorName : Text;
    text : Text;
    timestamp : Int;
  };
  module Comment {
    public func compareByTimestamp(c1 : Comment, c2 : Comment) : Order.Order {
      Int.compare(c1.timestamp, c2.timestamp);
    };
  };

  type FilterPreset = {
    id : Nat;
    projectId : Nat;
    createdByUserId : Nat;
    name : Text;
    assigneeId : ?Nat;
    tagIds : [Nat];
    unassignedOnly : Bool;
    textSearch : Text;
    dateField : ?Text;
    dateFrom : Text;
    dateTo : Text;
  };
  module FilterPreset {
    public func compareByName(p1 : FilterPreset, p2 : FilterPreset) : Order.Order {
      Text.compare(p1.name, p2.name);
    };
  };

  type Swimlane = {
    id : Nat;
    projectId : Nat;
    name : Text;
    order : Nat;
  };

  type ChecklistItem = {
    id : Nat;
    cardId : Nat;
    text : Text;
    isDone : Bool;
    order : Nat;
    createdAt : Int;
  };

  type ProjectSummary = {
    totalCards : Nat;
    overdueCount : Nat;
    dueSoonCount : Nat;
    unassignedCount : Nat;
    tagCounts : [(Nat, Nat)];
  };

  ///////////////////////////
  // State
  ///////////////////////////

  let projects = Map.empty<Nat, Project>();
  let users = Map.empty<Nat, User>();
  let columns = Map.empty<Nat, Column>();
  let cards = Map.empty<Nat, Card>();
  let tags = Map.empty<Nat, Tag>();
  let revisions = Map.empty<Nat, Revision>();
  let comments = Map.empty<Nat, Comment>();
  let filterPresets = Map.empty<Nat, FilterPreset>();
  let swimlanes = Map.empty<Nat, Swimlane>();
  let checklists = Map.empty<Nat, ChecklistItem>();

  var nextProjectId = 1;
  var nextUserId = 1;
  var nextColumnId = 1;
  var nextCardId = 1;
  var nextTagId = 1;
  var nextRevisionId = 1;
  var nextCommentId = 1;
  var nextFilterPresetId = 1;
  var nextSwimlaneId = 1;
  var nextChecklistItemId = 1;

  ///////////////////////////
  // Helper Functions
  ///////////////////////////

  func getUserName(userId : Nat) : Text {
    switch (users.get(userId)) {
      case (null) { "Unknown" };
      case (?user) { user.name };
    };
  };

  func logRevision(
    projectId : Nat,
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
      projectId;
    };
    revisions.add(nextRevisionId, rev);
    nextRevisionId += 1;
  };

  func isAdmin(userId : Nat) : Bool {
    switch (users.get(userId)) {
      case (null) { false };
      case (?user) { user.isAdmin or user.isMasterAdmin };
    };
  };

  func isMasterAdmin(userId : Nat) : Bool {
    switch (users.get(userId)) {
      case (null) { false };
      case (?user) { user.isMasterAdmin };
    };
  };

  func addDefaultColumnsToProject(projectId : Nat) {
    addDefaultColumn("To Do", projectId);
    addDefaultColumn("In Progress", projectId);
    addDefaultColumn("Done", projectId);
  };

  func addDefaultColumn(name : Text, projectId : Nat) {
    let column : Column = {
      id = nextColumnId;
      name;
      projectId;
      cardIds = List.empty<Nat>();
    };
    columns.add(nextColumnId, column);
    nextColumnId += 1;
  };

  ///////////////////////////
  // Admin Role Management
  ///////////////////////////

  public shared ({ caller }) func setupMasterAdmin(name : Text, pinHash : Text) : async Nat {
    if (isAnyAdminExists()) {
      Runtime.trap("Master admin already set up");
    };

    let userId = nextUserId;
    let newUser : User = {
      id = userId;
      name;
      pinHash;
      isAdmin = true;
      isMasterAdmin = true;
      securityQuestion = null;
      securityAnswerHash = null;
    };
    users.add(userId, newUser);
    nextUserId += 1;

    logRevision(
      0,
      userId,
      "setup_master_admin",
      "Master admin '" # name # "' created",
      null,
    );

    userId;
  };

  public query ({ caller }) func isAdminSetup() : async Bool {
    isAnyAdminExists();
  };

  func isAnyAdminExists() : Bool {
    not users.isEmpty() and users.values().toArray().filter(
      func(u) { u.isAdmin or u.isMasterAdmin }
    ).size() > 0;
  };

  public shared ({ caller }) func promoteUser(userId : Nat, actorUserId : Nat) : async () {
    if (not isMasterAdmin(actorUserId)) {
      Runtime.trap("Only master admin can promote users");
    };
    switch (users.get(userId)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) {
        if (user.isMasterAdmin) {
          Runtime.trap("Cannot promote master admin");
        };
        users.add(userId, { user with isAdmin = true });

        logRevision(
          0,
          actorUserId,
          "promote_user",
          "User '" # user.name # "' promoted to admin by " # getUserName(actorUserId),
          null,
        );
      };
    };
  };

  public shared ({ caller }) func demoteUser(userId : Nat, actorUserId : Nat) : async () {
    if (not isMasterAdmin(actorUserId)) {
      Runtime.trap("Only master admin can demote users");
    };
    switch (users.get(userId)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) {
        if (user.isMasterAdmin) {
          Runtime.trap("Cannot demote master admin");
        };
        if (userId == actorUserId) {
          Runtime.trap("Cannot demote yourself");
        };
        users.add(userId, { user with isAdmin = false });

        logRevision(
          0,
          actorUserId,
          "demote_user",
          "User '" # user.name # "' demoted from admin by " # getUserName(actorUserId),
          null,
        );
      };
    };
  };

  ///////////////////////////
  // Project Functions
  ///////////////////////////

  public query ({ caller }) func getProjects() : async [Project] {
    projects.values().toArray();
  };

  public shared ({ caller }) func createProject(name : Text, actorUserId : Nat) : async Nat {
    let projectId = nextProjectId;
    let newProject : Project = {
      id = projectId;
      name;
      swimlanesEnabled = false;
    };
    projects.add(projectId, newProject);
    nextProjectId += 1;

    logRevision(
      0,
      actorUserId,
      "create_project",
      "Project '" # name # "' created by " # getUserName(actorUserId),
      null,
    );

    addDefaultColumnsToProject(projectId);
    projectId;
  };

  public shared ({ caller }) func renameProject(
    projectId : Nat,
    newName : Text,
    actorUserId : Nat,
  ) : async () {
    switch (projects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?project) {
        projects.add(projectId, { project with name = newName });

        logRevision(
          projectId,
          actorUserId,
          "rename_project",
          "Project '" # project.name # "' renamed to '" # newName # "' by " # getUserName(actorUserId),
          null,
        );
      };
    };
  };

  public shared ({ caller }) func deleteProject(
    projectId : Nat,
    actorUserId : Nat,
  ) : async () {
    switch (projects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?project) {
        // Remove columns associated with the project
        let columnsToRemove = columns.toArray().filter(
          func((_, column)) { column.projectId == projectId }
        );

        for (elem in columnsToRemove.values()) {
          columns.remove(elem.0);
        };

        // Remove cards associated with the project
        let cardsToRemove = cards.toArray().filter(
          func((_, card)) { card.projectId == projectId }
        );

        for (elem in cardsToRemove.values()) {
          cards.remove(elem.0);
        };

        // Remove tags associated with the project
        let tagsToRemove = tags.toArray().filter(
          func((_, tag)) { tag.projectId == projectId }
        );

        for (elem in tagsToRemove.values()) {
          tags.remove(elem.0);
        };

        projects.remove(projectId);

        logRevision(
          0,
          actorUserId,
          "delete_project",
          "Project '" # project.name # "' deleted by " # getUserName(actorUserId),
          null,
        );
      };
    };
  };

  public shared ({ caller }) func initDefaultProject() : async Nat {
    if (projects.isEmpty()) {
      // Create new default project
      let projectId = nextProjectId;
      let newProject : Project = {
        id = projectId;
        name = "My Board";
        swimlanesEnabled = false;
      };
      projects.add(projectId, newProject);
      nextProjectId += 1;

      addDefaultColumnsToProject(projectId);

      projectId;
    } else {
      // Get the first project's id
      let allProjects = projects.values().toArray();
      let firstProject = allProjects[0];
      firstProject.id;
    };
  };

  ///////////////////////////
  // User Management
  ///////////////////////////

  public shared ({ caller }) func createUser(name : Text, pinHash : Text) : async Nat {
    let userId = nextUserId;
    let newUser : User = {
      id = userId;
      name;
      pinHash;
      isAdmin = false;
      isMasterAdmin = false;
      securityQuestion = null;
      securityAnswerHash = null;
    };
    users.add(userId, newUser);
    nextUserId += 1;

    logRevision(
      0,
      userId,
      "create_user",
      "User '" # name # "' created",
      null,
    );

    userId;
  };

  public shared ({ caller }) func deleteUser(userId : Nat, actorUserId : Nat) : async () {
    switch (users.get(userId)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) {
        if (user.isMasterAdmin) {
          Runtime.trap("Cannot delete master admin");
        };
        if (not isAdmin(actorUserId) and userId != actorUserId) {
          Runtime.trap("Not authorized to delete user");
        };

        users.remove(userId);

        logRevision(
          0,
          actorUserId,
          "delete_user",
          "User '" # user.name # "' deleted by " # getUserName(actorUserId),
          null,
        );
      };
    };
  };

  public query ({ caller }) func getUsers() : async [User] {
    users.values().toArray().sort();
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
          0,
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
    actorUserId : Nat,
    newPinHash : Text,
  ) : async () {
    switch (users.get(userId)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) {
        if (not isAdmin(actorUserId)) {
          Runtime.trap("Not authorized to reset PIN");
        };
        if (user.isMasterAdmin and not isMasterAdmin(actorUserId)) {
          Runtime.trap("Only master admin can reset own PIN");
        };

        users.add(userId, { user with pinHash = newPinHash });

        logRevision(
          0,
          actorUserId,
          "reset_pin",
          getUserName(actorUserId) # " reset PIN for user '" # user.name # "'",
          null,
        );
      };
    };
  };

  ///////////////////////////
  // Column Management
  ///////////////////////////

  type ColumnView = {
    id : Nat;
    name : Text;
    projectId : Nat;
    cardIds : [Nat];
  };
  module ColumnView {
    public func fromColumn(column : Column) : ColumnView {
      {
        id = column.id;
        name = column.name;
        projectId = column.projectId;
        cardIds = column.cardIds.toArray();
      };
    };

    public func fromColumns(columns : [Column]) : [ColumnView] {
      columns.map(fromColumn);
    };
  };

  public shared ({ caller }) func createColumn(
    name : Text,
    actorUserId : Nat,
    projectId : Nat,
  ) : async Nat {
    let columnId = nextColumnId;
    let column : Column = {
      id = columnId;
      name;
      projectId;
      cardIds = List.empty<Nat>();
    };
    columns.add(columnId, column);
    nextColumnId += 1;

    logRevision(
      projectId,
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
          column.projectId,
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
          column.projectId,
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
      0,
      actorUserId,
      "reorder_columns",
      "Columns reordered by " # getUserName(actorUserId),
      null,
    );
  };

  public query ({ caller }) func getColumns(projectId : Nat) : async [ColumnView] {
    let filtered = columns.values().toArray().filter(
      func(column) { column.projectId == projectId },
    ).sort();
    ColumnView.fromColumns(filtered);
  };

  public shared ({ caller }) func initBoard() : async () {
    if (columns.isEmpty()) {
      ignore await initDefaultProject();
    };
  };

  ///////////////////////////
  // Card Management
  ///////////////////////////

  public shared ({ caller }) func createCard(
    title : Text,
    description : ?Text,
    columnId : Nat,
    actorUserId : Nat,
    projectId : Nat,
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
          projectId;
          assignedUserId = null;
          tags = [];
          dueDate = null;
          createdAt = Time.now();
          swimlaneId = null;
          isArchived = false;
          archivedAt = null;
        };

        let updatedCards = column.cardIds.clone();
        updatedCards.add(cardId);

        cards.add(cardId, card);
        columns.add(columnId, { column with cardIds = updatedCards });
        nextCardId += 1;

        logRevision(
          projectId,
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
          card.projectId,
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
          card.projectId,
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
                  card.projectId,
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
          card.projectId,
          actorUserId,
          "assign_card",
          actorName # " assigned card '" # card.title # "' to " # assignee,
          ?cardId,
        );
      };
    };
  };

  public query ({ caller }) func getCards(projectId : Nat) : async [Card] {
    cards.values().toArray().filter(
      func(card) { card.projectId == projectId and not card.isArchived },
    ).sort();
  };

  ///////////////////////////
  // Tag Management
  ///////////////////////////

  public query ({ caller }) func getProjectTags(projectId : Nat) : async [Tag] {
    tags.values().toArray().filter(
      func(tag) { tag.projectId == projectId },
    ).sort();
  };

  public shared ({ caller }) func createTag(
    projectId : Nat,
    name : Text,
    color : Text,
    actorUserId : Nat,
  ) : async Nat {
    if (not isAdmin(actorUserId)) {
      Runtime.trap("Not authorized to create tags");
    };
    let tagId = nextTagId;
    let tag : Tag = {
      id = tagId;
      projectId;
      name;
      color;
    };
    tags.add(tagId, tag);
    nextTagId += 1;

    logRevision(
      projectId,
      actorUserId,
      "create_tag",
      "Tag '" # name # "' created by " # getUserName(actorUserId),
      null,
    );
    tagId;
  };

  public shared ({ caller }) func renameTag(
    tagId : Nat,
    newName : Text,
    actorUserId : Nat,
  ) : async () {
    if (not isAdmin(actorUserId)) {
      Runtime.trap("Not authorized to rename tags");
    };
    switch (tags.get(tagId)) {
      case (null) { Runtime.trap("Tag not found") };
      case (?tag) {
        tags.add(tagId, { tag with name = newName });

        logRevision(
          tag.projectId,
          actorUserId,
          "rename_tag",
          "Tag '" # tag.name # "' renamed to '" # newName # "' by " # getUserName(actorUserId),
          null,
        );
      };
    };
  };

  public shared ({ caller }) func deleteTag(
    tagId : Nat,
    actorUserId : Nat,
  ) : async () {
    if (not isAdmin(actorUserId)) {
      Runtime.trap("Not authorized to delete tags");
    };
    switch (tags.get(tagId)) {
      case (null) { Runtime.trap("Tag not found") };
      case (?tag) {
        tags.remove(tagId);

        // Remove tag from all cards
        for ((cardId, card) in cards.entries()) {
          let newTags = card.tags.filter(func(t) { t != tagId });
          cards.add(cardId, { card with tags = newTags });
        };

        logRevision(
          tag.projectId,
          actorUserId,
          "delete_tag",
          "Tag '" # tag.name # "' deleted by " # getUserName(actorUserId),
          null,
        );
      };
    };
  };

  public shared ({ caller }) func updateCardTags(
    cardId : Nat,
    tagIds : [Nat],
    actorUserId : Nat,
  ) : async () {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?card) {
        cards.add(cardId, { card with tags = tagIds });

        // Generate a summary of tag names and colors
        let tagDetails = tagIds.map(
          func(tagId) {
            switch (tags.get(tagId)) {
              case (null) { { name = "Unknown"; color = "Unknown" } };
              case (?tag) { { name = tag.name; color = tag.color } };
            };
          }
        );
        let tagSummary = tagDetails.foldLeft("", func(acc, tag) { acc # " " # tag.name # " (" # tag.color # ")" });

        logRevision(
          card.projectId,
          actorUserId,
          "update_tag_assignment",
          getUserName(actorUserId) # " updated " # card.title # "'s tags: " # tagSummary,
          ?cardId,
        );
      };
    };
  };

  ///////////////////////////
  // Due Date Management
  ///////////////////////////

  public shared ({ caller }) func updateCardDueDate(
    cardId : Nat,
    dueDate : ?Int,
    actorUserId : Nat,
  ) : async () {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?card) {
        cards.add(cardId, { card with dueDate });

        let dueDateText = switch (dueDate) {
          case (null) { "No due date" };
          case (?date) { "Due " # dateInDaysFromNow(date) };
        };

        logRevision(
          card.projectId,
          actorUserId,
          "update_due_date",
          getUserName(actorUserId) # " updated " # card.title # "'s due date: " # dueDateText,
          ?cardId,
        );
      };
    };
  };

  func dateInDaysFromNow(dueDate : Int) : Text {
    let now = Time.now();
    let diff = dueDate - now;
    let days = diff / 86_400_000_000_000; // Nanoseconds in a day
    if (days == 0) { "today" } else if (days == 1) { "tomorrow" } else { days.toText() # " days from now" };
  };

  ///////////////////////////
  // Revision Log
  ///////////////////////////

  public query ({ caller }) func getRevisions(projectId : Nat) : async [Revision] {
    revisions.values().toArray().filter(
      func(rev) { rev.projectId == projectId },
    ).sort(Revision.compareByTimestamp);
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

  public shared ({ caller }) func clearRevisions() : async () {
    revisions.clear();
  };

  ///////////////////////////////
  // Comment Management
  ///////////////////////////////

  public shared ({ caller }) func addComment(
    cardId : Nat,
    text : Text,
    actorUserId : Nat,
  ) : async Nat {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?_) {
        let comment : Comment = {
          id = nextCommentId;
          cardId;
          authorId = actorUserId;
          authorName = getUserName(actorUserId);
          text;
          timestamp = Time.now();
        };
        comments.add(nextCommentId, comment);

        logRevision(
          cardId,
          actorUserId,
          "add_comment",
          "Comment added by " # getUserName(actorUserId),
          ?cardId,
        );
        nextCommentId += 1;
        comment.id;
      };
    };
  };

  public shared ({ caller }) func deleteComment(commentId : Nat, actorUserId : Nat) : async () {
    switch (comments.get(commentId)) {
      case (null) { Runtime.trap("Comment not found") };
      case (?comment) {
        if (actorUserId != comment.authorId and not isAdmin(actorUserId)) {
          Runtime.trap("Not authorized to delete comment");
        };

        logRevision(
          comment.cardId,
          actorUserId,
          "delete_comment",
          "Comment deleted by " # getUserName(actorUserId),
          ?comment.cardId,
        );

        comments.remove(commentId);
      };
    };
  };

  public query ({ caller }) func getCardComments(cardId : Nat) : async [Comment] {
    let filtered = comments.values().toArray().filter(
      func(comment) { comment.cardId == cardId }
    );
    filtered.sort(Comment.compareByTimestamp);
  };

  ///////////////////////////////
  // Bulk Card Movement
  ///////////////////////////////

  public shared ({ caller }) func moveCards(
    cardIds : [Nat],
    targetColumnId : Nat,
    actorUserId : Nat,
  ) : async () {
    switch (columns.get(targetColumnId)) {
      case (null) { Runtime.trap("Target column not found") };
      case (?targetColumn) {
        for (cardId in cardIds.values()) {
          switch (cards.get(cardId)) {
            case (null) { Runtime.trap("Card not found: " # cardId.toText()) };
            case (?card) {
              let sourceColumn = switch (columns.get(card.columnId)) {
                case (null) { Runtime.trap("Source column not found for card: " # cardId.toText()) };
                case (?col) { col };
              };

              let updatedSourceCards = sourceColumn.cardIds.filter(func(id) { id != cardId });
              columns.add(card.columnId, { sourceColumn with cardIds = updatedSourceCards });

              let updatedTargetCards = targetColumn.cardIds.clone();
              updatedTargetCards.add(cardId);

              cards.add(cardId, { card with columnId = targetColumnId });
              columns.add(targetColumnId, { targetColumn with cardIds = updatedTargetCards });

              logRevision(
                card.projectId,
                actorUserId,
                "move_card",
                getUserName(actorUserId) # " moved card '" # card.title # "' from '" # sourceColumn.name # "' to '" # targetColumn.name # "'",
                ?cardId,
              );
            };
          };
        };

        logRevision(
          targetColumn.projectId,
          actorUserId,
          "bulk_move",
          getUserName(actorUserId) # " moved " # cardIds.size().toText() # " cards to " # targetColumn.name,
          null,
        );
      };
    };
  };

  ///////////////////////////
  // Filter Presets
  ///////////////////////////

  public shared ({ caller }) func saveFilterPreset(
    projectId : Nat,
    createdByUserId : Nat,
    name : Text,
    assigneeId : ?Nat,
    tagIds : [Nat],
    unassignedOnly : Bool,
    textSearch : Text,
    dateField : ?Text,
    dateFrom : Text,
    dateTo : Text,
  ) : async Nat {
    let presetId = nextFilterPresetId;
    let newPreset : FilterPreset = {
      id = presetId;
      projectId;
      createdByUserId;
      name;
      assigneeId;
      tagIds;
      unassignedOnly;
      textSearch;
      dateField;
      dateFrom;
      dateTo;
    };

    filterPresets.add(presetId, newPreset);

    logRevision(
      projectId,
      createdByUserId,
      "save_filter_preset",
      "Filter preset '" # name # "' saved",
      null,
    );

    nextFilterPresetId += 1;
    presetId;
  };

  public query ({ caller }) func getFilterPresets(projectId : Nat) : async [FilterPreset] {
    let filtered : [FilterPreset] = filterPresets.values().toArray().filter(
      func(preset) { preset.projectId == projectId }
    );
    filtered.sort(FilterPreset.compareByName);
  };

  public shared ({ caller }) func deleteFilterPreset(
    presetId : Nat,
    actorUserId : Nat,
  ) : async () {
    switch (filterPresets.get(presetId)) {
      case (null) { Runtime.trap("Filter preset not found") };
      case (?preset) {
        if (preset.createdByUserId != actorUserId and not isAdmin(actorUserId)) {
          Runtime.trap("Not authorized to delete this filter preset");
        };

        filterPresets.remove(presetId);

        logRevision(
          preset.projectId,
          actorUserId,
          "delete_filter_preset",
          "Filter preset '" # preset.name # "' deleted",
          null,
        );
      };
    };
  };

  ///////////
  // Extensions (Simple Logic) - New
  ///////////

  public shared ({ caller }) func renameUser(userId : Nat, newName : Text, actorUserId : Nat) : async () {
    if (actorUserId != userId and not isMasterAdmin(actorUserId)) {
      Runtime.trap("Not authorized to rename user");
    };

    switch (users.get(userId)) {
      case (null) { Runtime.trap("User not found") };
      case (?user) {
        users.add(userId, { user with name = newName });
        logRevision(0, actorUserId, "rename_user", "User renamed to " # newName, null);
      };
    };
  };

  public shared ({ caller }) func setMasterAdminSecurityQuestion(
    question : Text,
    answerHash : Text,
    actorUserId : Nat,
  ) : async () {
    if (not isMasterAdmin(actorUserId)) {
      Runtime.trap("Only master admin can set security question");
    };

    let admin = users.values().toArray().find(func(u) { u.isMasterAdmin == true });
    switch (admin) {
      case (null) { Runtime.trap("Master admin not found") };
      case (?admin) {
        users.add(admin.id, { admin with securityQuestion = ?question; securityAnswerHash = ?answerHash });
        logRevision(0, actorUserId, "set_security_question", "Security question set", null);
      };
    };
  };

  public shared ({ caller }) func resetMasterAdminPinWithSecurityAnswer(
    answerHash : Text,
    newPinHash : Text,
  ) : async Bool {
    let admin = users.values().toArray().find(func(u) { u.isMasterAdmin == true });
    switch (admin) {
      case (null) { Runtime.trap("Master admin not found") };
      case (?admin) {
        switch (admin.securityAnswerHash) {
          case (?hash) {
            if (hash == answerHash) {
              users.add(admin.id, { admin with pinHash = newPinHash });
              logRevision(0, admin.id, "reset_pin", "PIN reset with security answer", null);
              true;
            } else { false };
          };
          case (null) { false };
        };
      };
    };
  };

  ///////////
  // Swimlanes - New
  ///////////
  public query ({ caller }) func getSwimlanes(projectId : Nat) : async [Swimlane] {
    let filtered = swimlanes.values().toArray().filter(
      func(s) { s.projectId == projectId }
    );
    filtered;
  };

  public shared ({ caller }) func createSwimlane(
    projectId : Nat,
    name : Text,
    actorUserId : Nat,
  ) : async Nat {
    if (not isAdmin(actorUserId)) {
      Runtime.trap("Not authorized to create swimlane");
    };
    let swimlaneId = nextSwimlaneId;
    let swimlane : Swimlane = {
      id = swimlaneId;
      projectId;
      name;
      order = swimlaneId;
    };
    swimlanes.add(swimlaneId, swimlane);
    nextSwimlaneId += 1;
    swimlaneId;
  };

  public shared ({ caller }) func renameSwimlane(swimlaneId : Nat, newName : Text, actorUserId : Nat) : async () {
    if (not isAdmin(actorUserId)) {
      Runtime.trap("Not authorized to rename swimlane");
    };
    switch (swimlanes.get(swimlaneId)) {
      case (null) { Runtime.trap("Swimlane not found") };
      case (?swimlane) {
        swimlanes.add(swimlaneId, { swimlane with name = newName });
      };
    };
  };

  public shared ({ caller }) func deleteSwimlane(swimlaneId : Nat, actorUserId : Nat) : async () {
    if (not isAdmin(actorUserId)) {
      Runtime.trap("Not authorized to delete swimlane");
    };
    swimlanes.remove(swimlaneId);
  };

  public shared ({ caller }) func reorderSwimlanes(newOrder : [Nat], actorUserId : Nat) : async () {
    if (not isAdmin(actorUserId)) {
      Runtime.trap("Not authorized to reorder swimlanes");
    };
    var order = 0;
    for (id in newOrder.values()) {
      switch (swimlanes.get(id)) {
        case (null) { Runtime.trap("Invalid swimlane id: " # id.toText()) };
        case (?swimlane) {
          swimlanes.add(id, { swimlane with order });
        };
      };
      order += 1;
    };
  };

  public shared ({ caller }) func enableSwimlanes(projectId : Nat, actorUserId : Nat) : async () {
    if (not isAdmin(actorUserId)) {
      Runtime.trap("Not authorized to enable swimlanes");
    };
    switch (projects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?project) {
        projects.add(projectId, { project with swimlanesEnabled = true });
      };
    };
  };

  public shared ({ caller }) func disableSwimlanes(projectId : Nat, actorUserId : Nat) : async () {
    if (not isAdmin(actorUserId)) {
      Runtime.trap("Not authorized to disable swimlanes");
    };
    switch (projects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?project) {
        projects.add(projectId, { project with swimlanesEnabled = false });
      };
    };
  };

  public shared ({ caller }) func updateCardSwimlane(cardId : Nat, swimlaneId : ?Nat, actorUserId : Nat) : async () {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?card) {
        cards.add(cardId, { card with swimlaneId });
      };
    };
  };

  ///////////////////////////
  // Checklist Items - New
  ///////////////////////////

  public query ({ caller }) func getChecklistItems(cardId : Nat) : async [ChecklistItem] {
    let filtered = checklists.values().toArray().filter(
      func(i) { i.cardId == cardId }
    );
    filtered;
  };

  public shared ({ caller }) func addChecklistItem(cardId : Nat, text : Text, actorUserId : Nat) : async Nat {
    let itemId = nextChecklistItemId;
    let item : ChecklistItem = {
      id = itemId;
      cardId;
      text;
      isDone = false;
      order = itemId;
      createdAt = Time.now();
    };
    checklists.add(itemId, item);
    nextChecklistItemId += 1;
    itemId;
  };

  public shared ({ caller }) func updateChecklistItem(
    itemId : Nat,
    text : Text,
    isDone : Bool,
    actorUserId : Nat,
  ) : async () {
    switch (checklists.get(itemId)) {
      case (null) { Runtime.trap("Checklist item not found") };
      case (?item) {
        checklists.add(itemId, { item with text; isDone });
      };
    };
  };

  public shared ({ caller }) func deleteChecklistItem(itemId : Nat, actorUserId : Nat) : async () {
    checklists.remove(itemId);
  };

  public shared ({ caller }) func reorderChecklistItems(cardId : Nat, newOrder : [Nat], actorUserId : Nat) : async () {
    var order = 0;
    for (id in newOrder.values()) {
      switch (checklists.get(id)) {
        case (null) { Runtime.trap("Invalid checklist item id: " # id.toText()) };
        case (?item) {
          checklists.add(id, { item with order });
        };
      };
      order += 1;
    };
  };

  ///////////
  // Card Archiving - New
  ///////////

  public shared ({ caller }) func archiveCard(cardId : Nat, actorUserId : Nat) : async () {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?card) {
        cards.add(cardId, { card with isArchived = true; archivedAt = ?Time.now() });
      };
    };
  };

  public shared ({ caller }) func restoreCard(cardId : Nat, actorUserId : Nat) : async () {
    switch (cards.get(cardId)) {
      case (null) { Runtime.trap("Card not found") };
      case (?card) {
        cards.add(cardId, { card with isArchived = false; archivedAt = null });
      };
    };
  };

  public query ({ caller }) func getArchivedCards(projectId : Nat) : async [Card] {
    cards.values().toArray().filter(
      func(card) { card.projectId == projectId and card.isArchived },
    );
  };

  ///////////////////////////
  // Project Summary - New
  ///////////////////////////

  public query ({ caller }) func getProjectSummary(projectId : Nat) : async ProjectSummary {
    let projectCards = cards.values().toArray().filter(func(c) { c.projectId == projectId });
    let currentTime = Time.now();
    let weekNanos = 604800000000000;

    let overdueCount = projectCards.filter(
      func(c) {
        switch (c.dueDate) {
          case (null) { false };
          case (?due) { due < currentTime };
        };
      }
    ).size();

    let dueSoonCount = projectCards.filter(
      func(c) {
        switch (c.dueDate) {
          case (null) { false };
          case (?due) { due >= currentTime and due <= currentTime + weekNanos };
        };
      }
    ).size();

    let unassignedCount = projectCards.filter(func(c) { c.assignedUserId == null }).size();

    // Calculate tag usage counts
    let tagCountArray = tagIdsToArray(projectCards);

    {
      totalCards = projectCards.size();
      overdueCount;
      dueSoonCount;
      unassignedCount;
      tagCounts = tagCountArray;
    };
  };

  func tagIdsToArray(cards : [Card]) : [(Nat, Nat)] {
    let tagMap = Map.empty<Nat, Nat>();

    for (card in cards.values()) {
      for (tagId in card.tags.values()) {
        let count = switch (tagMap.get(tagId)) {
          case (null) { 0 };
          case (?c) { c };
        };
        tagMap.add(tagId, count + 1);
      };
    };

    tagMap.toArray();
  };
};
