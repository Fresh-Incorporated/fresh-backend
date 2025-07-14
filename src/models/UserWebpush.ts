import { Table, Column, Model, PrimaryKey, AutoIncrement, DataType, Default, AllowNull, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { User } from './User';
import * as webPush from "web-push";

@Table({tableName: 'user_webpushs', timestamps: true, updatedAt: false})
export class UserWebpush extends Model<UserWebpush> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare data: webPush.PushSubscription;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare enabled: boolean;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number;

  @BelongsTo(() => User, 'userId')
  declare user: User;
}
