import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";

module {
  // Old types
  type OldColumn = {
    id : Nat;
    name : Text;
    cardIds : List.List<Nat>;
  };

  type OldCard = {
    id : Nat;
    title : Text;
    description : ?Text;
    columnId : Nat;
    assignedUserId : ?Nat;
  };

  type OldRevision = {
    id : Nat;
    actorName : Text;
    timestamp : Int;
    revisionType : Text;
    description : Text;
    cardId : ?Nat;
  };

  // Old actor type
  type OldActor = {
    users : Map.Map<Nat, { id : Nat; name : Text; pinHash : Text }>;
    columns : Map.Map<Nat, OldColumn>;
    cards : Map.Map<Nat, OldCard>;
    revisions : Map.Map<Nat, OldRevision>;
    nextUserId : Nat;
    nextColumnId : Nat;
    nextCardId : Nat;
    nextRevisionId : Nat;
    adminPinHash : ?Text;
  };

  // New types
  type Project = {
    id : Nat;
    name : Text;
  };

  type NewColumn = {
    id : Nat;
    name : Text;
    projectId : Nat;
    cardIds : List.List<Nat>;
  };

  type NewCard = {
    id : Nat;
    title : Text;
    description : ?Text;
    columnId : Nat;
    projectId : Nat;
    assignedUserId : ?Nat;
  };

  type NewRevision = {
    id : Nat;
    actorName : Text;
    timestamp : Int;
    revisionType : Text;
    description : Text;
    cardId : ?Nat;
    projectId : Nat;
  };

  // New actor type
  type NewActor = {
    projects : Map.Map<Nat, Project>;
    users : Map.Map<Nat, { id : Nat; name : Text; pinHash : Text }>;
    columns : Map.Map<Nat, NewColumn>;
    cards : Map.Map<Nat, NewCard>;
    revisions : Map.Map<Nat, NewRevision>;
    nextProjectId : Nat;
    nextUserId : Nat;
    nextColumnId : Nat;
    nextCardId : Nat;
    nextRevisionId : Nat;
    adminPinHash : ?Text;
  };

  public func run(old : OldActor) : NewActor {
    let newProjects = Map.empty<Nat, Project>();

    let defaultProject : Project = {
      id = 1;
      name = "My Board";
    };
    newProjects.add(1, defaultProject);
    let newColumns = old.columns.map<Nat, OldColumn, NewColumn>(
      func(_id, oldColumn) {
        { oldColumn with projectId = 1 };
      }
    );
    let newCards = old.cards.map<Nat, OldCard, NewCard>(
      func(_id, oldCard) {
        { oldCard with projectId = 1 };
      }
    );
    let newRevisions = old.revisions.map<Nat, OldRevision, NewRevision>(
      func(_id, oldRevision) {
        { oldRevision with projectId = 1 };
      }
    );
    {
      projects = newProjects;
      users = old.users;
      columns = newColumns;
      cards = newCards;
      revisions = newRevisions;
      nextProjectId = 2;
      nextUserId = old.nextUserId;
      nextColumnId = old.nextColumnId;
      nextCardId = old.nextCardId;
      nextRevisionId = old.nextRevisionId;
      adminPinHash = old.adminPinHash;
    };
  };
};
