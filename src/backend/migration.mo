import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Array "mo:core/Array";

module {
  // Column, Card, Revision Types (Unchanged)
  type Column = {
    id : Nat;
    name : Text;
    cardIds : List.List<Nat>;
  };

  type Card = {
    id : Nat;
    title : Text;
    description : ?Text;
    columnId : Nat;
    assignedUserId : ?Nat;
  };

  type Revision = {
    id : Nat;
    actorName : Text;
    timestamp : Int;
    revisionType : Text;
    description : Text;
    cardId : ?Nat;
  };

  // Old User Type and Actor State (no adminPinHash)
  type OldUser = {
    id : Nat;
    name : Text;
    pinHash : Text;
  };

  type OldActor = {
    users : Map.Map<Nat, OldUser>;
    columns : Map.Map<Nat, Column>;
    cards : Map.Map<Nat, Card>;
    revisions : Map.Map<Nat, Revision>;
    nextUserId : Nat;
    nextColumnId : Nat;
    nextCardId : Nat;
    nextRevisionId : Nat;
  };

  // New User Type and Actor State (with adminPinHash)
  type NewUser = {
    id : Nat;
    name : Text;
    pinHash : Text;
  };

  type NewActor = {
    users : Map.Map<Nat, NewUser>;
    columns : Map.Map<Nat, Column>;
    cards : Map.Map<Nat, Card>;
    revisions : Map.Map<Nat, Revision>;
    nextUserId : Nat;
    nextColumnId : Nat;
    nextCardId : Nat;
    nextRevisionId : Nat;
    adminPinHash : ?Text;
  };

  public func run(old : OldActor) : NewActor {
    let newUsers = old.users.map<Nat, OldUser, NewUser>(
      func(_id, oldUser) {
        oldUser;
      }
    );

    {
      old with
      users = newUsers;
      adminPinHash = null;
    };
  };
};
