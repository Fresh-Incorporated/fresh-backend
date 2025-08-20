import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  AllowNull,
  BelongsTo,
  ForeignKey
} from 'sequelize-typescript';
import {User} from "./User";

@Table({ tableName: 'pw_pixels', timestamps: false })
export class PWPixel extends Model<PWPixel> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare x: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare y: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare type: "border" | "state";

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare ownerId: number;

  @BelongsTo(() => User, 'ownerId')
  declare owner: User;
}
